import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAskResponse, readAskStream, type AskRow } from "./answer";

// radar-rag's recorded /ask bodies (lib/__fixtures__/contract/README.md): the
// parser is tested on what the service serves, not on what this repo imagines.
function fixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/contract/${name}`, import.meta.url), "utf8");
}

// Byte-sized chunks, so frames and multi-byte characters split mid-way as on a network.
function streamOf(text: string, size: number) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(c) {
      for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
      c.close();
    },
  });
}

function collect() {
  const seen = { sources: [] as AskRow[][], deltas: [] as string[] };
  return {
    seen,
    on: { sources: (r: AskRow[]) => seen.sources.push(r), delta: (t: string) => seen.deltas.push(t) },
  };
}

describe("the /ask contract radar-rag recorded", () => {
  it("accepts the JSON answer", () => {
    const body: unknown = JSON.parse(fixture("ask-answer.json"));
    expect(isAskResponse(body)).toBe(true);
    if (!isAskResponse(body)) return;
    expect(body.sources).toHaveLength(5);
    expect(body.citations.length).toBeGreaterThan(0);
    // Every cited row is one of the retrieved rows, so the page can link it.
    const retrieved = new Set(body.sources.map((r) => r.id));
    for (const c of body.citations) expect(retrieved.has(c.id)).toBe(true);
  });

  it("assembles the streamed answer into the same shape", async () => {
    const { seen, on } = collect();
    const out = await readAskStream(streamOf(fixture("ask-answer.sse"), 7), on);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(seen.sources).toHaveLength(1);
    expect(seen.sources[0]).toHaveLength(5);
    expect(seen.deltas.join("")).toBe(out.data.answer);
    expect(out.data.citations.length).toBeGreaterThan(0);
    expect(isAskResponse(out.data)).toBe(true);
  });

  it("retracts a refusal that ends in error after text already streamed", async () => {
    const { seen, on } = collect();
    expect(await readAskStream(streamOf(fixture("ask-refusal.sse"), 7), on)).toEqual({
      ok: false,
      status: 502,
    });
    expect(seen.deltas.length).toBeGreaterThan(0);
  });

  it("reports the model unavailable when the stream errors before any text", async () => {
    const { seen, on } = collect();
    expect(await readAskStream(streamOf(fixture("ask-unavailable.sse"), 7), on)).toEqual({
      ok: false,
      status: 503,
    });
    expect(seen.deltas).toEqual([]);
  });
});
