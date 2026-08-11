import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotionError,
  queryAll,
  resolveDataSourceId,
  text,
  type NProp,
} from "./notion";

// normalizeCJKPunct is not exported; text() is its only reachable entry point.
// text() reads p[k].rich_text (or .title) and joins the runs, then normalizes.
const cell = (s: string): Record<string, NProp> => ({
  Body: { rich_text: [{ plain_text: s }] },
});
const t = (s: string): string => text(cell(s), "Body");

describe("text() CJK punctuation normalization", () => {
  it("converts a Han-flanked half-width comma to full-width", () => {
    expect(t("中文，中文".replace("，", ","))).toBe("中文，中文");
  });

  it("normalizes each Han-flanked mark ,;:!? to its full-width form", () => {
    expect(t("甲,乙;丙:丁!戊?己")).toBe("甲，乙；丙：丁！戊？己");
  });

  it("normalizes a mark with a Han character on only one side", () => {
    // digit on the left, Han on the right -> still converted
    expect(t("3個?對")).toBe("3個？對");
  });

  it("leaves Latin-flanked punctuation untouched", () => {
    expect(t("a,b;c:d!e?f")).toBe("a,b;c:d!e?f");
  });

  it("leaves digit-flanked punctuation (decimals, ratios) untouched", () => {
    expect(t("1.5x ratio 3:4 and 1,000")).toBe("1.5x ratio 3:4 and 1,000");
  });

  it("returns an empty string for a missing cell", () => {
    expect(text({}, "Body")).toBe("");
  });
});

// notionFetch is module-private; queryAll is its thinnest reachable caller, so
// the client's retry / pagination / error-wrapping behavior is pinned through it
// with a stubbed global fetch.
describe("queryAll (notionFetch behavior)", () => {
  const page = (results: unknown[], nextCursor: string | null = null) =>
    new Response(
      JSON.stringify({
        results,
        has_more: nextCursor !== null,
        next_cursor: nextCursor,
      }),
      { status: 200 },
    );
  const rateLimited = () =>
    new Response(JSON.stringify({ message: "rate limited" }), {
      status: 429,
      headers: { "Retry-After": "0" },
    });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("retries a 429 and succeeds on the next attempt", async () => {
    vi.stubEnv("NOTION_TOKEN", "ntn_test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited())
      .mockResolvedValueOnce(page([{ id: "r1", properties: {} }]));
    vi.stubGlobal("fetch", fetchMock);
    const rows = await queryAll("ds-1", {});
    expect(rows.map((r) => r.id)).toEqual(["r1"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 retries and surfaces the API message as a NotionError", async () => {
    vi.stubEnv("NOTION_TOKEN", "ntn_test");
    const fetchMock = vi.fn().mockImplementation(async () => rateLimited());
    vi.stubGlobal("fetch", fetchMock);
    const p = queryAll("ds-1", {});
    await expect(p).rejects.toBeInstanceOf(NotionError);
    await expect(p).rejects.toThrow("rate limited");
    expect(fetchMock).toHaveBeenCalledTimes(4); // initial call + 3 retries
  });

  it("follows pagination cursors until has_more is false", async () => {
    vi.stubEnv("NOTION_TOKEN", "ntn_test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([{ id: "r1", properties: {} }], "cursor-2"))
      .mockResolvedValueOnce(page([{ id: "r2", properties: {} }]));
    vi.stubGlobal("fetch", fetchMock);
    const rows = await queryAll("ds-1", {});
    expect(rows.map((r) => r.id)).toEqual(["r1", "r2"]);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondBody.start_cursor).toBe("cursor-2");
  });

  it("wraps a non-ok response's message in a NotionError", async () => {
    vi.stubEnv("NOTION_TOKEN", "ntn_test");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: "boom" }), { status: 400 }),
        ),
    );
    await expect(queryAll("ds-1", {})).rejects.toThrow("boom");
  });

  it("fails loudly before any network call when NOTION_TOKEN is unset", async () => {
    const original = process.env.NOTION_TOKEN;
    delete process.env.NOTION_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(queryAll("ds-1", {})).rejects.toThrow("NOTION_TOKEN");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (original !== undefined) process.env.NOTION_TOKEN = original;
    }
  });
});

// resolveDataSourceId tries the data-source endpoint first and falls back to the
// database endpoint. A bare `catch` made every failure look like "not a data
// source", so an expired token surfaced as whatever the SECOND call happened to
// return — a wrong cause pointing at the wrong endpoint.
describe("resolveDataSourceId fallback", () => {
  beforeEach(() => {
    vi.stubEnv("NOTION_TOKEN", "ntn_test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const stub = (...responses: Response[]) => {
    const fetchMock = vi.fn();
    for (const r of responses) fetchMock.mockResolvedValueOnce(r);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("falls back to the database endpoint after a data-source 404", async () => {
    const fetchMock = stub(
      new Response(JSON.stringify({ message: "not found" }), { status: 404 }),
      new Response(JSON.stringify({ data_sources: [{ id: "resolved-source" }] })),
    );
    await expect(resolveDataSourceId("database-id")).resolves.toBe(
      "resolved-source",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the id unchanged when it already is a data source", async () => {
    const fetchMock = stub(new Response(JSON.stringify({ id: "ds-1" })));
    await expect(resolveDataSourceId("ds-1")).resolves.toBe("ds-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rethrows an auth failure instead of masking it with the fallback", async () => {
    const fetchMock = stub(
      new Response(JSON.stringify({ message: "API token is invalid." }), {
        status: 401,
      }),
    );
    await expect(resolveDataSourceId("ds-1")).rejects.toThrow(
      "API token is invalid.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rethrows a server error instead of masking it with the fallback", async () => {
    const fetchMock = stub(
      new Response(JSON.stringify({ message: "internal error" }), {
        status: 500,
      }),
    );
    await expect(resolveDataSourceId("ds-1")).rejects.toThrow("internal error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
