// Shared session helpers. NOT marked `server-only`: proxy.ts imports this and the
// proxy runs in the Node runtime (Next 16) outside the RSC graph, where
// `server-only` would throw. Every reader here is server-side regardless.
import { timingSafeEqual } from "crypto";

// Constant-time string compare; false on length mismatch. Used for both the
// login password and the session cookie so an attacker can't probe either by
// timing.
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// The session cookie holds AUTH_SECRET verbatim. Fails SAFE when the secret is
// unset (an absent cookie must never equal an absent secret), so a missing-env
// misconfiguration locks the app rather than opening it.
export function isAuthed(cookieValue: string | undefined): boolean {
  const secret = process.env.AUTH_SECRET;
  return !!secret && !!cookieValue && safeEqual(cookieValue, secret);
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
