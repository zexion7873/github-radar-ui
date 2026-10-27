"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  safeEqual,
  safeRedirect,
  SESSION_TTL_S,
} from "@/lib/auth";

// Per-instance on serverless, so a speed bump, not a guarantee: the real defense
// is a high-entropy APP_PASSWORD.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const FAIL_DELAY_MS = 500;
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  // Without the sweep, a long-lived `next start` keeps one record per IP ever seen.
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
  // Vercel overwrites X-Forwarded-For, so its first entry is the client. Behind a
  // proxy that appends instead, each client could pick a fresh throttle key.
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const password = String(formData.get("password") ?? "");
  const from = safeRedirect(String(formData.get("from") ?? "/"));
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;

  if (tooMany(ip)) {
    redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
  }

  // A missing env var and a wrong password answer identically; only the server
  // log tells them apart.
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
  // Home is public; only /loot is gated.
  redirect("/");
}
