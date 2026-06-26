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
