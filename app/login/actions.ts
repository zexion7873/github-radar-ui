"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  safeEqual,
  safeRedirect,
  SESSION_TTL_S,
} from "@/lib/auth";
import { clearFailures, recordFailure, tooMany } from "@/lib/login-throttle";

const FAIL_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function login(formData: FormData) {
  // Vercel overwrites X-Forwarded-For, so its first entry is the client. Behind a
  // proxy that appends instead, each client could pick a fresh throttle key.
  const ip =
    // 45 = the longest textual IP, so a forged header cannot inflate every record.
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 45) ||
    "unknown";
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

  clearFailures(ip);

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
