type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

// Prune expired entries periodically to avoid unbounded growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }, 60_000)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Sliding-window rate limiter keyed by an arbitrary string (e.g. `ip:route`).
 * Works for single-instance deployments; swap for Redis-backed solution when scaling.
 *
 * @param key      Unique identifier (IP + route recommended)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  entry.count += 1
  const allowed = entry.count <= limit
  return { allowed, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt }
}

/**
 * Returns the best available client IP from standard proxy headers.
 * Prefer `x-real-ip` (set by a trusted reverse proxy) over `x-forwarded-for`.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  )
}
