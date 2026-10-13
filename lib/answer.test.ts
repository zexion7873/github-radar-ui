import { describe, expect, it } from "vitest";
import {
  askErrorMessage,
  isAskResponse,
  joinPassages,
  nameLinks,
  parseAnswer,
  parseInline,
  previewAnswer,
  readAskStream,
  rowHref,
  rowLabel,
  stripLeadingLabel,
  takeSseEvents,
  uncitedSources,
} from "./answer";

// Captured verbatim through radar-rag's own message converters: an absent field
// arrives as an explicit null. A validator that rejects null fails every answer.
const CAPTURED_SOURCES =
  '[{"id":"63eddf42-adc2-3c43-be45-acfbf497bed8","source":"trending","repo":"o/repo-0","title":null,"url":"https://github.com/o/repo-0","week":"2026-09-21","score":1.0},{"id":"271e1078-071d-3e9b-ab5d-2a2253b3580e","source":"blog","repo":null,"title":"A post","url":"https://x.test/p","week":"2026-09-30","score":1.0}]';
const CAPTURED_BODY =
  '{"answer":"Try it.","citations":[{"id":"271e1078-071d-3e9b-ab5d-2a2253b3580e","source":"blog","repo":null,"title":"A post","url":"https://x.test/p","week":"2026-09-30","score":1.0,"citedText":["A post"]},{"id":"63eddf42-adc2-3c43-be45-acfbf497bed8","source":"trending","repo":"o/repo-0","title":null,"url":"https://github.com/o/repo-0","week":"2026-09-21","score":1.0,"citedText":["repo-0"]}],' +
  `"sources":${CAPTURED_SOURCES},` +
  '"usage":{"model":"claude-opus-5-5","inputTokens":10,"outputTokens":5}}';
const CAPTURED_DONE =
  '{"answer":"Grounded answer.","citations":[{"id":"271e1078-071d-3e9b-ab5d-2a2253b3580e","source":"blog","repo":null,"title":"A post","url":"https://x.test/p","week":"2026-09-30","score":1.0,"citedText":["A post"]}],"usage":{"model":"claude-opus-5-5","inputTokens":10,"outputTokens":5}}';

describe("parseInline", () => {
  it("splits bold and code runs out of plain text", () => {
    expect(parseInline("用 **mem0** 或 `letta` 都行")).toEqual([
      { kind: "text", text: "用 " },
      { kind: "strong", text: "mem0" },
      { kind: "text", text: " 或 " },
      { kind: "code", text: "letta" },
      { kind: "text", text: " 都行" },
    ]);
  });

  it("keeps markup-looking text as text, never as an element", () => {
    expect(parseInline('<img src=x onerror="alert(1)">')).toEqual([
      { kind: "text", text: '<img src=x onerror="alert(1)">' },
    ]);
  });

  it("leaves an empty bold or code pair as literal text", () => {
    expect(parseInline("a **** b ``")).toEqual([{ kind: "text", text: "a **** b ``" }]);
  });
});

describe("parseAnswer", () => {
  it("groups consecutive bullets into one list and breaks it on a paragraph", () => {
    expect(parseAnswer("先看這兩個：\n- one\n2. two\n\n結論")).toEqual([
      { kind: "p", inline: [{ kind: "text", text: "先看這兩個：" }] },
      {
        kind: "ul",
        items: [[{ kind: "text", text: "one" }], [{ kind: "text", text: "two" }]],
      },
      { kind: "p", inline: [{ kind: "text", text: "結論" }] },
    ]);
  });

  it("treats a line that is only one bold run as a subhead, colon or not", () => {
    expect(parseAnswer("**實際可用的工具**\n**怎麼選：**")).toEqual([
      { kind: "h3", inline: [{ kind: "text", text: "實際可用的工具" }] },
      { kind: "h3", inline: [{ kind: "text", text: "怎麼選：" }] },
    ]);
  });

  it("keeps a bold lead-in followed by prose as a paragraph", () => {
    expect(parseAnswer("**選擇建議**：看 benchmark 就選 hindsight。")).toEqual([
      {
        kind: "p",
        inline: [
          { kind: "strong", text: "選擇建議" },
          { kind: "text", text: "：看 benchmark 就選 hindsight。" },
        ],
      },
    ]);
  });

  it("turns a markdown heading into an h3 and drops blank lines", () => {
    expect(parseAnswer("## 記憶層\n\n\nbody")).toEqual([
      { kind: "h3", inline: [{ kind: "text", text: "記憶層" }] },
      { kind: "p", inline: [{ kind: "text", text: "body" }] },
    ]);
  });
});

describe("rowHref", () => {
  const id = "3bf2e058-e02d-81c5-8cae-ff1a172107c2";

  it("links a trending row to this site's detail page", () => {
    expect(rowHref({ id, source: "trending", url: "https://github.com/a/b" })).toEqual({
      href: `/trending/${id}`,
      internal: true,
    });
  });

  it("links a blog row to /blog", () => {
    expect(rowHref({ id, source: "blog" })).toEqual({ href: `/blog/${id}`, internal: true });
  });

  it("falls back to the original URL when the id is not a page id", () => {
    expect(rowHref({ id: "x1", source: "trending", url: "https://github.com/a/b" })).toEqual({
      href: "https://github.com/a/b",
      internal: false,
    });
  });

  it("gives no link for a non-http URL", () => {
    expect(rowHref({ id: "x1", source: "blog", url: "javascript:alert(1)" })).toBeNull();
  });
});

describe("rowLabel", () => {
  it("prefers repo, then title, then url, then id", () => {
    expect(rowLabel({ id: "i", source: "trending", repo: "a/b", title: "t" })).toBe("a/b");
    expect(rowLabel({ id: "i", source: "blog", title: "t", url: "u" })).toBe("t");
    expect(rowLabel({ id: "i", source: "blog" })).toBe("i");
  });
});

describe("askErrorMessage", () => {
  it("names the rate limit on 429", () => {
    expect(askErrorMessage(429)).toContain("每人每分鐘 5 題、每天 20 題");
  });

  it("echoes an unmapped status", () => {
    expect(askErrorMessage(418)).toContain("（418）");
  });
});

describe("isAskResponse", () => {
  const ok = {
    answer: "a",
    citations: [{ id: "i", source: "trending", citedText: ["q"] }],
    sources: [],
    usage: { model: "claude-opus-5-5", inputTokens: 1, outputTokens: 2 },
  };

  it("accepts the documented /ask shape", () => {
    expect(isAskResponse(ok)).toBe(true);
  });

  it("rejects a body missing the answer, or a row without an id", () => {
    expect(isAskResponse({ ...ok, answer: undefined })).toBe(false);
    expect(isAskResponse({ ...ok, sources: [{ source: "blog" }] })).toBe(false);
    expect(isAskResponse(null)).toBe(false);
  });

  it("rejects mistyped optional row fields and token counts", () => {
    const row = { id: "i", source: "blog" };
    expect(isAskResponse({ ...ok, sources: [{ ...row, title: 42 }] })).toBe(false);
    expect(isAskResponse({ ...ok, sources: [{ ...row, score: "0.9" }] })).toBe(false);
    expect(isAskResponse({ ...ok, citations: [{ ...row, citedText: "q" }] })).toBe(false);
    expect(isAskResponse({ ...ok, citations: [{ ...row, citedText: [1] }] })).toBe(false);
    expect(
      isAskResponse({ ...ok, usage: { ...ok.usage, inputTokens: { n: 1 } } }),
    ).toBe(false);
  });

  it("accepts a body captured from radar-rag", () => {
    expect(isAskResponse(JSON.parse(CAPTURED_BODY))).toBe(true);
  });

  it("accepts the nulls radar-rag's records serialize for absent fields", () => {
    const blogRow = {
      id: "i",
      source: "blog",
      repo: null,
      title: "t",
      url: null,
      week: null,
      score: null,
      citedText: null,
    };
    expect(
      isAskResponse({
        ...ok,
        citations: [blogRow],
        sources: [blogRow],
        usage: { model: "m", inputTokens: null, outputTokens: null },
      }),
    ).toBe(true);
  });
});

describe("uncitedSources", () => {
  it("keeps only the retrieved rows the answer did not cite", () => {
    const row = (id: string) => ({ id, source: "trending" });
    const data = {
      answer: "a",
      citations: [row("a"), row("b")],
      sources: [row("b"), row("c"), row("a"), row("d")],
      usage: { model: "m", inputTokens: 1, outputTokens: 1 },
    };
    expect(uncitedSources(data).map((r) => r.id)).toEqual(["c", "d"]);
  });
});

describe("stripLeadingLabel", () => {
  it("drops the repo name a passage opens with", () => {
    expect(
      stripLeadingLabel("vectorize-io/hindsight Agent 記憶系統", "vectorize-io/hindsight"),
    ).toBe("Agent 記憶系統");
  });

  it("leaves a passage that does not open with the label untouched", () => {
    expect(stripLeadingLabel("Agent 記憶系統", "vectorize-io/hindsight")).toBe("Agent 記憶系統");
  });
});

describe("joinPassages", () => {
  it("joins sentence-level passages with an ellipsis", () => {
    expect(joinPassages(["用 retain 讓 agent 學習。", "  本週漲幅第一。 "], "a/b")).toBe(
      "用 retain 讓 agent 學習。 … 本週漲幅第一。",
    );
  });

  it("strips the label from a passage and drops passages left empty", () => {
    expect(joinPassages(["a/b", "a/b 記憶系統。", ""], "a/b")).toBe("記憶系統。");
  });

  it("is empty when nothing remains", () => {
    expect(joinPassages([], "a/b")).toBe("");
  });
});

describe("nameLinks", () => {
  const id = "3bf2e058-e02d-81c5-8cae-ff1a172107c2";

  it("maps a row's label, lowercased, to its link", () => {
    const links = nameLinks({
      citations: [{ id, source: "trending", repo: "vectorize-io/Hindsight" }],
      sources: [{ id: "x1", source: "blog", title: "How to Give Your Agent Memory", url: "https://b.example/p" }],
    });
    expect(links.get("vectorize-io/hindsight")).toEqual({ href: `/trending/${id}`, internal: true });
    expect(links.get("how to give your agent memory")).toEqual({ href: "https://b.example/p", internal: false });
  });

  it("skips a row with nothing to link to", () => {
    const links = nameLinks({
      citations: [{ id: "x1", source: "blog", title: "No link" }],
      sources: [],
    });
    expect(links.size).toBe(0);
  });
});

describe("previewAnswer", () => {
  it("holds back a bold run until its closing marker arrives", () => {
    expect(previewAnswer("用 **mem")).toEqual([{ kind: "p", inline: [{ kind: "text", text: "用" }] }]);
  });

  it("holds back an open code span and a lone trailing asterisk", () => {
    expect(previewAnswer("跑 `npx")).toEqual([{ kind: "p", inline: [{ kind: "text", text: "跑" }] }]);
    expect(previewAnswer("看 *")).toEqual([{ kind: "p", inline: [{ kind: "text", text: "看" }] }]);
  });

  it("keeps an unfinished lone bold line a paragraph, not a subhead", () => {
    expect(previewAnswer("開頭\n**Hindsight**")).toEqual([
      { kind: "p", inline: [{ kind: "text", text: "開頭" }] },
      { kind: "p", inline: [{ kind: "strong", text: "Hindsight" }] },
    ]);
  });

  it("makes it a subhead once its newline arrives", () => {
    expect(previewAnswer("開頭\n**Hindsight**\n")).toEqual([
      { kind: "p", inline: [{ kind: "text", text: "開頭" }] },
      { kind: "h3", inline: [{ kind: "text", text: "Hindsight" }] },
    ]);
  });

  it("hides a bare bullet marker and joins a growing bullet to its list", () => {
    expect(previewAnswer("- one\n- ")).toEqual([
      { kind: "ul", items: [[{ kind: "text", text: "one" }]] },
    ]);
    expect(previewAnswer("- one\n- tw")).toEqual([
      { kind: "ul", items: [[{ kind: "text", text: "one" }], [{ kind: "text", text: "tw" }]] },
    ]);
  });
});

describe("takeSseEvents", () => {
  it("splits complete frames and returns the unfinished one as rest", () => {
    expect(takeSseEvents('event:delta\ndata:{"text":"a"}\n\nevent:del')).toEqual({
      events: [{ event: "delta", data: '{"text":"a"}' }],
      rest: "event:del",
    });
  });

  it("accepts CRLF, a space after the colon, comments and multi-line data", () => {
    expect(takeSseEvents(": ping\r\n\r\nevent: done\r\ndata: x\r\ndata: y\r\n\r\n")).toEqual({
      events: [{ event: "done", data: "x\ny" }],
      rest: "",
    });
  });
});

describe("readAskStream", () => {
  const id = "3bf2e058-e02d-81c5-8cae-ff1a172107c2";
  const row = { id, source: "trending", repo: "vectorize-io/hindsight" };
  const usage = { model: "m", inputTokens: 1, outputTokens: 2 };

  // Splits the encoded stream into fixed-size byte chunks, so frames and
  // multi-byte characters break mid-way the way a network delivers them.
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
    const seen = { sources: [] as unknown[], deltas: [] as string[] };
    return {
      seen,
      on: { sources: (r: unknown) => seen.sources.push(r), delta: (t: string) => seen.deltas.push(t) },
    };
  }

  it("accepts a stream captured from radar-rag", async () => {
    const wire =
      `event:sources\ndata:${CAPTURED_SOURCES}\n\n` +
      `event:delta\ndata:{"text":"Grounded "}\n\n` +
      `event:delta\ndata:{"text":"answer."}\n\n` +
      `event:done\ndata:${CAPTURED_DONE}\n\n`;
    const out = await readAskStream(streamOf(wire, 64), collect().on);
    expect(out.ok && out.data.answer).toBe("Grounded answer.");
  });

  it("rejects a streamed source row with a mistyped field before rendering it", async () => {
    const wire =
      `event:sources\ndata:[{"id":"i","source":"blog","title":42}]\n\n` +
      `event:done\ndata:${JSON.stringify({ answer: "a", citations: [], usage })}\n\n`;
    const { seen, on } = collect();
    expect(await readAskStream(streamOf(wire, 64), on)).toEqual({
      ok: false,
      status: null,
    });
    expect(seen.sources).toEqual([]);
  });

  it("assembles sources and done into an AskResponse across byte-split chunks", async () => {
    const wire =
      `event:sources\ndata:${JSON.stringify([row])}\n\n` +
      `event:delta\ndata:{"text":"記憶"}\n\n` +
      `event:delta\ndata:{"text":"工具"}\n\n` +
      `event:done\ndata:${JSON.stringify({ answer: "記憶工具", citations: [row], usage })}\n\n`;
    const { seen, on } = collect();
    const out = await readAskStream(streamOf(wire, 7), on);
    expect(seen.deltas).toEqual(["記憶", "工具"]);
    expect(seen.sources).toEqual([[row]]);
    expect(out).toEqual({
      ok: true,
      data: { answer: "記憶工具", citations: [row], sources: [row], usage },
    });
  });

  it("returns the status of an error event after deltas already streamed", async () => {
    const wire =
      `event:sources\ndata:[]\n\n` +
      `event:delta\ndata:{"text":"partial"}\n\n` +
      `event:error\ndata:{"status":502,"message":"declined"}\n\n`;
    const { seen, on } = collect();
    expect(await readAskStream(streamOf(wire, 5), on)).toEqual({ ok: false, status: 502 });
    expect(seen.deltas).toEqual(["partial"]);
  });

  it("fails a stream that ends without done", async () => {
    const wire = `event:sources\ndata:[]\n\nevent:delta\ndata:{"text":"cut"}\n\n`;
    expect(await readAskStream(streamOf(wire, 64), collect().on)).toEqual({ ok: false, status: null });
  });

  it("fails a done that arrives without sources", async () => {
    const wire = `event:done\ndata:${JSON.stringify({ answer: "a", citations: [], usage })}\n\n`;
    expect(await readAskStream(streamOf(wire, 64), collect().on)).toEqual({ ok: false, status: null });
  });

  it("fails a malformed delta instead of rendering it", async () => {
    const wire = `event:sources\ndata:[]\n\nevent:delta\ndata:not json\n\n`;
    expect(await readAskStream(streamOf(wire, 64), collect().on)).toEqual({ ok: false, status: null });
  });
});
