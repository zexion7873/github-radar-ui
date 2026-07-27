// Shared session helpers. NOT marked `server-only`: proxy.ts imports this and the
// proxy runs in the Node runtime (Next 16) outside the RSC graph, where
// `server-only` would throw. Every reader here is server-side regardless.
import { createHmac, timingSafeEqual } from "crypto";

// Constant-time string compare; false on length mismatch. Used for both the
// login password and the session cookie so an attacker can't probe either by
// timing.
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Session lifetime. One constant feeds both the token's embedded expiry and the
// cookie's maxAge, so the server-side check and the browser's eviction agree.
export const SESSION_TTL_S = 60 * 60 * 24 * 30; // 30 days

function sign(exp: number, secret: string): string {
  // Domain-separation prefix so this HMAC can never be confused with any other
  // future use of AUTH_SECRET.
  return createHmac("sha256", secret)
    .update(`gh-radar-session.v1:${exp}`)
    .digest("hex");
}

// Session token: "<unix-seconds expiry>.<hmac>". The cookie no longer carries
// AUTH_SECRET itself — the secret stays server-side, and a leaked cookie dies on
// its own expiry instead of living until someone rotates the secret. Rotating
// AUTH_SECRET still invalidates every session at once (the signatures stop
// verifying), which keeps the old "one knob revokes everything" property.
export function createSessionToken(now = Date.now()): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const exp = Math.floor(now / 1000) + SESSION_TTL_S;
  return `${exp}.${sign(exp, secret)}`;
}

// Verifies expiry + signature. Fails SAFE when the secret is unset (an absent
// cookie must never verify against an absent secret), so a missing-env
// misconfiguration locks the app rather than opening it. A pre-HMAC cookie
// (AUTH_SECRET verbatim) has no "." and simply fails — merging this change
// logs every existing session out once.
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

// Where to land after login. Only a same-origin path may pass: no scheme, no
// authority. Must reject "//host" AND "/\host" — the WHATWG URL parser treats a
// backslash after the leading slash like a second slash, so a bare
// startsWith("//") check leaves "/\evil.com" as a protocol-relative open
// redirect in every browser. That parser ALSO strips every ASCII tab and newline
// before it parses, so "/<TAB>/host" collapses to "//host" too — the leading-
// slash lookahead can't see through them, and rejecting the raw characters is
// the only way to close that door. Lives here (not in the "use server" actions
// file, which may only export async functions) so it stays unit-testable.
export function safeRedirect(from: string): string {
  return /^\/(?![/\\])/.test(from) && !/[\t\r\n]/.test(from) ? from : "/";
}
