import { beforeEach, describe, expect, it, vi } from "vitest";

describe("login throttle", () => {
  // `attempts` is module-level state, so every test gets a virgin module.
  let t: typeof import("./login-throttle");
  beforeEach(async () => {
    vi.resetModules();
    t = await import("./login-throttle");
  });

  const throttle = (ip: string) => {
    t.tooMany(ip);
    for (let i = 0; i < 10; i++) t.recordFailure(ip);
  };

  it("throttles an address after 10 failures", () => {
    throttle("198.51.100.1");
    expect(t.tooMany("198.51.100.1")).toBe(true);
  });

  it("drops the oldest record once MAX_TRACKED addresses are tracked", () => {
    expect(t.MAX_TRACKED).toBe(10_000);
    throttle("198.51.100.1");
    for (let i = 0; i < t.MAX_TRACKED; i++) t.tooMany(`10.0.${i >> 8}.${i & 255}`);
    expect(t.tooMany("198.51.100.1")).toBe(false);
  });
});
