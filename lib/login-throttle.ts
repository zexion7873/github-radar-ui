// Per-instance on serverless, so a speed bump, not a guarantee: the real defense
// is a high-entropy APP_PASSWORD.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
// Without a cap, a flood of distinct addresses grows the map, and the sweep
// below, for the whole window; past it the oldest record is dropped.
export const MAX_TRACKED = 10_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function tooMany(ip: string): boolean {
  const now = Date.now();
  // Without the sweep, a long-lived `next start` keeps one record per IP ever seen.
  for (const [k, rec] of attempts) if (now > rec.resetAt) attempts.delete(k);
  const rec = attempts.get(ip);
  if (!rec) {
    if (attempts.size >= MAX_TRACKED) attempts.delete(attempts.keys().next().value!);
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

export function recordFailure(ip: string) {
  const rec = attempts.get(ip);
  if (rec) rec.count += 1;
}

// A successful login ends the failure window — the counter's job is done.
export function clearFailures(ip: string) {
  attempts.delete(ip);
}
