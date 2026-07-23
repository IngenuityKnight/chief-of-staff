// Best-effort in-process rate limiter (audit S6). Sliding window per key.
//
// On serverless this is per-instance, so the real ceiling is (limit × warm
// instances) — still enough to stop cost-drain loops and accidental runaway
// clients. Swap the Map for Upstash/Vercel KV when multi-instance accuracy
// matters; the call sites won't change.

type Window = { start: number; count: number };

const windows = new Map<string, Window>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded.
  if (windows.size > MAX_KEYS) {
    for (const [k, w] of windows) {
      if (now - w.start > windowMs) windows.delete(k);
    }
  }

  const current = windows.get(key);
  if (!current || now - current.start > windowMs) {
    windows.set(key, { start: now, count: 1 });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count > limit) {
    const retryAfterSeconds = Math.ceil((current.start + windowMs - now) / 1000);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  return { ok: true, remaining: limit - current.count, retryAfterSeconds: 0 };
}

/** Stable key for a request: prefer the tenant, fall back to client IP. */
export function rateLimitKey(scope: string, householdId: string | null, req: Request): string {
  if (householdId) return `${scope}:hh:${householdId}`;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${scope}:ip:${forwarded ?? "unknown"}`;
}
