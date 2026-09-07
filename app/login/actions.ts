"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  safeEqual,
  safeRedirect,
  SESSION_TTL_S,
} from "@/lib/auth";

// Best-effort brute-force throttle. The per-IP counter is module state, so on
// serverless it's per-instance and leaky — a speed bump, not a guarantee; the
// real defense is a high-entropy APP_PASSWORD. The fixed per-failure delay below
// applies to every attempt that reaches the credential check regardless of
// instance, so an online guess always pays a fixed cost; an already-throttled
// request is rejected without it rather than holding compute it doesn't need.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const FAIL_DELAY_MS = 500;
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  // Sweep expired windows first: serverless instances die young, but a
  // long-lived `next start` would otherwise grow the map by one record per IP
  // ever seen. Doubles as the old per-IP expiry reset.
  for (const [k, rec] of attempts) if (now > rec.resetAt) attempts.delete(k);
  const rec = attempts.get(ip);
  if (!rec) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
  const rec = attempts.get(ip);
  if (rec) rec.count += 1;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function login(formData: FormData) {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const password = String(formData.get("password") ?? "");
  const from = safeRedirect(String(formData.get("from") ?? "/"));
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;

  if (tooMany(ip)) {
    redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
  }

  // A missing env var and a wrong password deliberately produce the identical
  // response — an unauthenticated client must not learn which. The operator does
  // need to know, so the difference surfaces in the server log only.
  if (!expected)
    console.error("[login] APP_PASSWORD is not set — every login will fail");
  if (!secret)
    console.error("[login] AUTH_SECRET is not set — every login will fail");

  if (!expected || !secret || !safeEqual(password, expected)) {
    recordFailure(ip);
    await sleep(FAIL_DELAY_MS);
    redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
  }

  // A successful login ends the failure window — the counter's job is done.
  attempts.delete(ip);

  (await cookies()).set("gh_radar", createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  redirect(from);
}

export async function logout() {
  (await cookies()).delete("gh_radar");
  // Home is public now, so land there after logout rather than bouncing to the
  // login screen (only /loot/* is gated).
  redirect("/");
}
