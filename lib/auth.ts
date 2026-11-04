// Not `server-only`: proxy.ts imports it outside the RSC graph, where that
// marker throws.
import { createHmac, timingSafeEqual } from "crypto";

// Constant-time, so neither the password nor the session cookie leaks by timing.
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Session lifetime. One constant feeds both the token's embedded expiry and the
// cookie's maxAge, so the server-side check and the browser's eviction agree.
export const SESSION_TTL_S = 60 * 60 * 24 * 30; // 30 days

// SESSION_VERSION is any string, "" when unset. Changing it in the environment
// revokes every session without touching AUTH_SECRET: logout only deletes the
// browser's copy of the cookie, so this is the one way to kill a copied one
// before its expiry. The v2 prefix is what made it part of the signed input.
function sign(exp: number, secret: string): string {
  // Domain-separation prefix so this HMAC can never be confused with any other
  // future use of AUTH_SECRET.
  return createHmac("sha256", secret)
    .update(`gh-radar-session.v2:${process.env.SESSION_VERSION ?? ""}:${exp}`)
    .digest("hex");
}

// "<unix-seconds expiry>.<hmac>": a leaked cookie dies at its expiry, and
// rotating AUTH_SECRET or SESSION_VERSION revokes every session at once.
export function createSessionToken(now = Date.now()): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const exp = Math.floor(now / 1000) + SESSION_TTL_S;
  return `${exp}.${sign(exp, secret)}`;
}

// Fails safe when AUTH_SECRET is unset, so a missing env var locks the app
// rather than letting an absent cookie verify against an absent secret.
export function isAuthed(
  cookieValue: string | undefined,
  now = Date.now(),
): boolean {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !cookieValue) return false;
  const dot = cookieValue.indexOf(".");
  if (dot < 1) return false;
  const exp = Number(cookieValue.slice(0, dot));
  if (!Number.isSafeInteger(exp) || exp * 1000 <= now) return false;
  return safeEqual(cookieValue.slice(dot + 1), sign(exp, secret));
}

// Same-origin paths only. Browsers read "/\host" as "//host" and drop tabs and
// newlines before parsing, so all of them must be rejected or this is an open redirect.
export function safeRedirect(from: string): string {
  return /^\/(?![/\\])/.test(from) && !/[\t\r\n]/.test(from) ? from : "/";
}
