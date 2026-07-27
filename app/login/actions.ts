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
// DOES apply on every request regardless of instance, so an online guess always
// pays a fixed cost.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const FAIL_DELAY_MS = 500;
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
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

  if (!expected || !secret || !safeEqual(password, expected)) {
    recordFailure(ip);
    await sleep(FAIL_DELAY_MS);
    redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
  }

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
