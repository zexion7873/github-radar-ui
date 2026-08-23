import { describe, expect, it } from "vitest";
import { parseVerdict } from "./config";

// Strings here are verbatim from the Notion Loot Ledger, not reconstructed from
// the regex — a case the parser and the test both derive the same way could never
// disagree with it.
describe("parseVerdict", () => {
  it("splits the bucket off the reason", () => {
    expect(
      parseVerdict("already-have — 內建 Plan Mode 擋得更嚴；★2、06-20 後沒動"),
    ).toEqual({
      bucket: "already-have",
      reason: "內建 Plan Mode 擋得更嚴；★2、06-20 後沒動",
    });
  });

  it("keeps a trial's flip-when tail inside the reason", () => {
    const { bucket, reason } = parseVerdict(
      "trial — 機制乾淨，要裝 docling/pypdf 等 extractor; flip when 手上有一本技術書要讓 agent 隨查",
    );
    expect(bucket).toBe("trial");
    expect(reason).toBe(
      "機制乾淨，要裝 docling/pypdf 等 extractor; flip when 手上有一本技術書要讓 agent 隨查",
    );
  });

  it("keeps every line of a multi-line reason", () => {
    expect(parseVerdict("skip — 第一行\n第二行").reason).toBe("第一行\n第二行");
  });

  it("renders a hand-typed note whole rather than dropping it", () => {
    expect(parseVerdict("看起來不錯但先放著")).toEqual({
      bucket: null,
      reason: "看起來不錯但先放著",
    });
  });

  it("needs the em dash — a bare bucket word is not the contract", () => {
    expect(parseVerdict("adopt")).toEqual({ bucket: null, reason: "adopt" });
  });

  it("reads an untriaged row as no verdict at all", () => {
    expect(parseVerdict("")).toEqual({ bucket: null, reason: "" });
  });
});
