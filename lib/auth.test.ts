import { afterEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  isAuthed,
  safeEqual,
  safeRedirect,
  SESSION_TTL_S,
} from "./auth";

describe("safeEqual", () => {
  it("returns false on length mismatch", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("returns true for equal strings", () => {
    expect(safeEqual("secret-value", "secret-value")).toBe(true);
  });

  it("returns false for unequal strings of the same length", () => {
    expect(safeEqual("abcdef", "abcxyz")).toBe(false);
  });
});

describe("session tokens", () => {
  const original = process.env.AUTH_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = original;
  });

  it("fails safe (false) when AUTH_SECRET is unset", () => {
    delete process.env.AUTH_SECRET;
    expect(isAuthed("anything")).toBe(false);
  });

  it("createSessionToken throws when AUTH_SECRET is unset", () => {
    delete process.env.AUTH_SECRET;
    expect(() => createSessionToken()).toThrow("AUTH_SECRET");
  });

  it("returns false when the cookie is undefined even if the secret is set", () => {
    process.env.AUTH_SECRET = "the-secret";
    expect(isAuthed(undefined)).toBe(false);
  });

  it("accepts a freshly minted token", () => {
    process.env.AUTH_SECRET = "the-secret";
    expect(isAuthed(createSessionToken())).toBe(true);
  });

  it("rejects an expired token", () => {
    process.env.AUTH_SECRET = "the-secret";
    const mintedAt = Date.now();
    const token = createSessionToken(mintedAt);
    const afterExpiry = mintedAt + (SESSION_TTL_S + 1) * 1000;
    expect(isAuthed(token, afterExpiry)).toBe(false);
  });

  it("rejects a token whose expiry was tampered with", () => {
    process.env.AUTH_SECRET = "the-secret";
    const token = createSessionToken();
    const [exp, sig] = token.split(".");
    expect(isAuthed(`${Number(exp) + 9999}.${sig}`)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    process.env.AUTH_SECRET = "old-secret";
    const token = createSessionToken();
    process.env.AUTH_SECRET = "new-secret"; // rotation revokes every session
    expect(isAuthed(token)).toBe(false);
  });

  it("rejects a legacy cookie carrying AUTH_SECRET verbatim", () => {
    process.env.AUTH_SECRET = "the-secret";
    expect(isAuthed("the-secret")).toBe(false);
  });

  it("rejects garbage shapes", () => {
    process.env.AUTH_SECRET = "the-secret";
    expect(isAuthed("")).toBe(false);
    expect(isAuthed(".")).toBe(false);
    expect(isAuthed("notanumber.abcdef")).toBe(false);
    expect(isAuthed("12345")).toBe(false);
  });
});

describe("safeRedirect", () => {
  it("passes ordinary same-origin paths through", () => {
    expect(safeRedirect("/")).toBe("/");
    expect(safeRedirect("/loot/claude")).toBe("/loot/claude");
    expect(safeRedirect("/trending?x=1")).toBe("/trending?x=1");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeRedirect("https://evil.com")).toBe("/");
    expect(safeRedirect("//evil.com")).toBe("/");
    expect(safeRedirect("")).toBe("/");
  });

  it("rejects the backslash bypass — browsers parse /\\host like //host", () => {
    expect(safeRedirect("/\\evil.com")).toBe("/");
    expect(safeRedirect("/\\/evil.com")).toBe("/");
  });

  // The URL parser removes tab/CR/LF before parsing, so each of these collapses
  // to a protocol-relative "//evil.com" in the browser even though the raw
  // string looks like a path. Verified: new URL("/\t/evil.com", origin).href is
  // "https://evil.com/".
  it("rejects the tab/newline bypass — the parser strips them, then sees //host", () => {
    expect(safeRedirect("/\t/evil.com")).toBe("/");
    expect(safeRedirect("/\r/evil.com")).toBe("/");
    expect(safeRedirect("/\n/evil.com")).toBe("/");
    expect(safeRedirect("/\t\\evil.com")).toBe("/");
  });
});
