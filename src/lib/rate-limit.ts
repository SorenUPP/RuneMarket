/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Good enough for a single-instance / low-traffic deployment and cheap
 * to add without a new infra dependency. It is NOT safe for a
 * horizontally-scaled deployment (multiple server instances would each
 * keep their own counters, so the effective limit becomes
 * limit * instanceCount) — if this app is ever deployed behind a load
 * balancer with more than one instance, swap this out for a shared store
 * (e.g. Redis/Upstash) using the same `check()` signature.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically sweep expired buckets so this map doesn't grow forever.
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = Date.now();
function sweep() {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller can retry, only set when ok is false. */
  retryAfterSeconds?: number;
}

/**
 * Checks and increments the counter for `key` (e.g. `import:{userId}`).
 * Returns { ok: false, retryAfterSeconds } once `limit` requests have
 * been made within the current `windowMs` window.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  sweep();
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true };
}
