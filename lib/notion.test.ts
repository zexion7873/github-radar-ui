import { describe, expect, it } from "vitest";
import { text, type NProp } from "./notion";

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
