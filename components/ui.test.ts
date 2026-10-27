import { describe, expect, it, vi } from "vitest";

// next/link calls createContext, which the react-server build used under test lacks.
vi.mock("next/link", () => ({ default: () => null }));

import {
  CATEGORY_HUE,
  MAINTAINED_BADGE,
  RISK_BADGE,
  STATUS_LABEL,
  VERDICT_BADGE,
} from "./ui";

describe("Notion-keyed lookup maps", () => {
  it("miss on Object.prototype member names", () => {
    for (const map of [MAINTAINED_BADGE, RISK_BADGE, VERDICT_BADGE, STATUS_LABEL]) {
      expect(map["__proto__"]).toBeUndefined();
      expect(map["constructor"]).toBeUndefined();
    }
    expect("constructor" in CATEGORY_HUE).toBe(false);
  });

  it("still hit their own keys", () => {
    expect(MAINTAINED_BADGE.stale).toBe("停更");
    expect(RISK_BADGE.high).toBe("高風險");
    expect(Object.keys(CATEGORY_HUE)).toContain("agents");
  });
});
