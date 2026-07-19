import { afterEach, describe, expect, it } from "vitest";
import { isAuthed, safeEqual, safeRedirect } from "./auth";

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

describe("isAuthed", () => {
  const original = process.env.AUTH_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = original;
  });

  it("fails safe (false) when AUTH_SECRET is unset", () => {
    delete process.env.AUTH_SECRET;
    expect(isAuthed("anything")).toBe(false);
  });

  it("returns false when the cookie is undefined even if the secret is set", () => {
    process.env.AUTH_SECRET = "the-secret";
    expect(isAuthed(undefined)).toBe(false);
  });

  it("returns true when the cookie matches the secret", () => {
    process.env.AUTH_SECRET = "the-secret";
    expect(isAuthed("the-secret")).toBe(true);
  });

  it("returns false when the cookie does not match the secret", () => {
    process.env.AUTH_SECRET = "the-secret";
    expect(isAuthed("wrong-secret")).toBe(false);
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
});
