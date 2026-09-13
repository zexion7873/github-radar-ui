import { describe, expect, it } from "vitest";
import { splitSummary } from "./summary";

const labels = (s: string) =>
  splitSummary(s)
    .filter((b) => b.label)
    .map((b) => b.text);

describe("splitSummary", () => {
  it("promotes an unpunctuated short line between paragraphs", () => {
    expect(labels("導言。\n\n核心方法\n\n數字上升了。")).toEqual(["核心方法"]);
  });

  it("never promotes the opening block, even unpunctuated", () => {
    expect(labels("本週無重大進展")).toEqual([]);
  });

  it("peels a label glued to its body by a lone newline", () => {
    expect(splitSummary("導言。\n\n核心方法\n數字上升了。")).toEqual([
      { text: "導言。", label: false },
      { text: "核心方法", label: true },
      { text: "數字上升了。", label: false },
    ]);
  });

  it("keeps a body-first block whole so its lone newline survives", () => {
    expect(splitSummary("導言。\n\n很短的正文段落。\n侷限")).toEqual([
      { text: "導言。", label: false },
      { text: "很短的正文段落。\n侷限", label: false },
    ]);
  });

  it("promotes the longest label the archive holds (43 chars, CJK + Latin)", () => {
    expect(
      labels("導言。\n\n第一封：Open Weights and American AI Leadership\n\n內文。"),
    ).toEqual(["第一封：Open Weights and American AI Leadership"]);
  });

  it("leaves a short sentence ending in a curly quote as body", () => {
    expect(labels("導言。\n\n他把這稱為 “reward hacking”\n\n內文。")).toEqual([]);
  });

  it("demotes a block past the length cap even when unpunctuated", () => {
    const long = "導".repeat(49);
    expect(labels(`導言。\n\n${long}\n\n內文。`)).toEqual([]);
  });

  it("splits on a blank line and drops the empty blocks", () => {
    expect(splitSummary("一。\n\n\n二。").map((b) => b.text)).toEqual([
      "一。",
      "二。",
    ]);
  });
});
