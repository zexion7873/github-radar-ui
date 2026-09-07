import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// login() answers four distinct conditions — rate-limited, APP_PASSWORD unset,
// AUTH_SECRET unset, wrong password — with one identical redirect. That sameness
// IS the security property, so these tests assert the responses are equal rather
// than letting a later refactor "helpfully" split them apart.
const { cookieSet, xff, redirect } = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  xff: { value: "203.0.113.7" as string | null },
  // The real next/navigation.redirect throws NEXT_REDIRECT, and login() relies on
  // that to stop before minting a cookie — so the double must throw too.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => xff.value }),
  cookies: async () => ({ set: cookieSet }),
}));

vi.mock("next/navigation", () => ({ redirect }));

import { isAuthed } from "@/lib/auth";

const FAIL_REDIRECT = "NEXT_REDIRECT:/login?error=1&from=%2Floot%2Fclaude";
const OK_REDIRECT = "NEXT_REDIRECT:/loot/claude";

const form = (password: string, from = "/loot/claude") => {
  const fd = new FormData();
  fd.set("password", password);
  fd.set("from", from);
  return fd;
};

describe("login", () => {
  // `attempts` is module-level state, so every test gets a virgin module.
  let login: typeof import("./actions").login;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ login } = await import("./actions"));
    process.env.APP_PASSWORD = "correct-horse";
    process.env.AUTH_SECRET = "test-secret";
    xff.value = "203.0.113.7";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.APP_PASSWORD;
    delete process.env.AUTH_SECRET;
  });

  // The 500ms failure delay runs on fake timers so the suite doesn't pay it.
  const rejects = async (fd: FormData) => {
    const done = expect(login(fd)).rejects.toThrow(FAIL_REDIRECT);
    await vi.advanceTimersByTimeAsync(500);
    await done;
  };

  it("rejects a wrong password", async () => {
    await rejects(form("nope"));
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("answers an unset APP_PASSWORD with the wrong-password response", async () => {
    delete process.env.APP_PASSWORD;
    await rejects(form("correct-horse"));
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("answers an unset AUTH_SECRET the same way, and names it in the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.AUTH_SECRET;
    await rejects(form("correct-horse"));
    expect(cookieSet).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "[login] AUTH_SECRET is not set — every login will fail",
    );
    log.mockRestore();
  });

  it("sets a verifiable session cookie and lands on `from`", async () => {
    await expect(login(form("correct-horse"))).rejects.toThrow(OK_REDIRECT);
    expect(cookieSet).toHaveBeenCalledTimes(1);
    const [name, value, opts] = cookieSet.mock.calls[0];
    expect(name).toBe("gh_radar");
    expect(isAuthed(value)).toBe(true);
    expect(opts).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 2592000, // 30 days
    });
  });

  it("sends an off-site `from` to / instead", async () => {
    await expect(login(form("correct-horse", "/\\evil.com"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirect).toHaveBeenCalledWith("/");
    expect(cookieSet).toHaveBeenCalledTimes(1);
  });

  it("throttles the 11th attempt — even with the correct password", async () => {
    for (let i = 0; i < 10; i++) await rejects(form("nope"));
    await rejects(form("correct-horse"));
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("throttles per IP, not globally", async () => {
    for (let i = 0; i < 10; i++) await rejects(form("nope"));
    xff.value = "198.51.100.9";
    await expect(login(form("correct-horse"))).rejects.toThrow(OK_REDIRECT);
    expect(cookieSet).toHaveBeenCalledTimes(1);
  });

  it("self-heals once the 10-minute window passes", async () => {
    for (let i = 0; i < 10; i++) await rejects(form("nope"));
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1);
    await expect(login(form("correct-horse"))).rejects.toThrow(OK_REDIRECT);
    expect(cookieSet).toHaveBeenCalledTimes(1);
  });

  it("a successful login restarts the failure count", async () => {
    for (let i = 0; i < 9; i++) await rejects(form("nope"));
    await expect(login(form("correct-horse"))).rejects.toThrow(OK_REDIRECT);
    // 18 failures in total, but only 9 since the reset — still under the cap.
    for (let i = 0; i < 9; i++) await rejects(form("nope"));
    await expect(login(form("correct-horse"))).rejects.toThrow(OK_REDIRECT);
    expect(cookieSet).toHaveBeenCalledTimes(2);
  });
});
