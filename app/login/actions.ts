"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function safeRedirect(from: string): string {
  return from.startsWith("/") && !from.startsWith("//") ? from : "/";
}

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const from = safeRedirect(String(formData.get("from") ?? "/"));
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;

  if (!expected || !secret || !safeEqual(password, expected)) {
    redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
  }

  (await cookies()).set("gh_radar", secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  redirect(from);
}
