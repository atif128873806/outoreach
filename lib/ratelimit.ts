/**
 * Small in-memory rate limiter (fixed window per key). Suits the current
 * single-process deployment; swap for a shared store when scaling out.
 */

const globalForRl = globalThis as unknown as {
  __outreachRl?: Map<string, { count: number; resetAt: number }>;
};

const buckets = (globalForRl.__outreachRl ??= new Map());

/** Returns true when the call is allowed, false when the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}

/** Best-effort client IP for rate-limit keys. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/**
 * DB-backed fixed-window limiter for auth-sensitive endpoints (login, signup,
 * password reset). Unlike the in-memory one it survives restarts and is shared
 * across instances. Fails open if the database is unreachable — auth must not
 * hard-down because of the limiter.
 */
export async function rateLimitDb(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  try {
    const { q, q1 } = await import("./db");
    const resetAt = new Date(Date.now() + windowMs).toISOString();
    const row = await q1<{ count: number }>(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET
         count    = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
       RETURNING count`,
      [key, resetAt]
    );
    // Opportunistic cleanup of long-expired windows (~1% of calls).
    if (Math.random() < 0.01) {
      void q("DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'").catch(() => {});
    }
    return (row?.count ?? 1) <= limit;
  } catch (err) {
    console.error("[ratelimit] db limiter failed (allowing request):", err);
    return true;
  }
}
