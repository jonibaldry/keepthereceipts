// A single Node process backs this app (see docker-compose.yml — one
// `frontend` container, no clustering), so an in-memory limiter is enough;
// no shared store needed.
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Bounds memory from the many distinct one-off keys (e.g. attacker IPs that
// are each only ever seen once) that would otherwise sit in the map
// forever, since only entries actually looked up again get cleaned up
// in-line. Sweeping periodically rather than on every call keeps the
// common-case cost at one map lookup.
const SWEEP_INTERVAL = 500
let callsSinceSweep = 0

function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export class RateLimitError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super("rate limit exceeded")
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// Fixed-window counter: throws RateLimitError once `key` has been checked
// more than `max` times within the current `windowMs` window.
export function checkRateLimit(key: string, opts: { max: number; windowMs: number }): void {
  const now = Date.now()

  callsSinceSweep += 1
  if (callsSinceSweep >= SWEEP_INTERVAL) {
    callsSinceSweep = 0
    sweepExpired(now)
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return
  }

  bucket.count += 1
  if (bucket.count > opts.max) {
    throw new RateLimitError(Math.ceil((bucket.resetAt - now) / 1000))
  }
}
