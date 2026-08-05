import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkRateLimit, RateLimitError } from "./rate-limit.server"

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows up to max calls within the window", () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(() => checkRateLimit(key, { max: 3, windowMs: 1000 })).not.toThrow()
    }
  })

  it("throws RateLimitError on the call after max is exceeded", () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 3; i++) checkRateLimit(key, { max: 3, windowMs: 1000 })

    expect(() => checkRateLimit(key, { max: 3, windowMs: 1000 })).toThrow(RateLimitError)
  })

  it("reports a positive retryAfterSeconds when the limit is hit", () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 3; i++) checkRateLimit(key, { max: 3, windowMs: 10_000 })

    try {
      checkRateLimit(key, { max: 3, windowMs: 10_000 })
      throw new Error("expected checkRateLimit to throw")
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfterSeconds).toBeGreaterThan(0)
    }
  })

  it("resets the count once the window has elapsed", () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 3; i++) checkRateLimit(key, { max: 3, windowMs: 1000 })
    expect(() => checkRateLimit(key, { max: 3, windowMs: 1000 })).toThrow(RateLimitError)

    vi.setSystemTime(1001)

    expect(() => checkRateLimit(key, { max: 3, windowMs: 1000 })).not.toThrow()
  })

  it("tracks separate keys independently", () => {
    const keyA = `a-${Math.random()}`
    const keyB = `b-${Math.random()}`
    for (let i = 0; i < 3; i++) checkRateLimit(keyA, { max: 3, windowMs: 1000 })

    expect(() => checkRateLimit(keyA, { max: 3, windowMs: 1000 })).toThrow(RateLimitError)
    expect(() => checkRateLimit(keyB, { max: 3, windowMs: 1000 })).not.toThrow()
  })
})
