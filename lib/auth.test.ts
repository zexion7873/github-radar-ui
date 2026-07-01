import { afterEach, describe, expect, it } from "vitest";
import { isAuthed, safeEqual } from "./auth";

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
