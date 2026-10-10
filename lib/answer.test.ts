import { describe, expect, it } from "vitest";
import {
  askErrorMessage,
  isAskResponse,
  joinPassages,
  nameLinks,
  parseAnswer,
  parseInline,
  rowHref,
  rowLabel,
  stripLeadingLabel,
  uncitedSources,
} from "./answer";

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
      answer: "a",
      citations: [{ id, source: "trending", repo: "vectorize-io/Hindsight" }],
      sources: [{ id: "x1", source: "blog", title: "How to Give Your Agent Memory", url: "https://b.example/p" }],
      usage: { model: "m", inputTokens: 1, outputTokens: 1 },
    });
    expect(links.get("vectorize-io/hindsight")).toEqual({ href: `/trending/${id}`, internal: true });
    expect(links.get("how to give your agent memory")).toEqual({ href: "https://b.example/p", internal: false });
  });

  it("skips a row with nothing to link to", () => {
    const links = nameLinks({
      answer: "a",
      citations: [{ id: "x1", source: "blog", title: "No link" }],
      sources: [],
      usage: { model: "m", inputTokens: 1, outputTokens: 1 },
    });
    expect(links.size).toBe(0);
  });
});
