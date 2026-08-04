import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createSessionToken, verifySessionToken } from "./session.server"

describe("session.server", () => {
  const originalSecret = process.env.JWT_SECRET

  beforeEach(() => {
    process.env.JWT_SECRET = "test-only-secret-do-not-use-in-prod"
  })

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret
  })

  it("round-trips a session token back to the same user", async () => {
    const token = await createSessionToken({ id: "user_abc123", username: "alice" })
    const user = await verifySessionToken(token)
    expect(user).toEqual({ id: "user_abc123", username: "alice" })
  })

  it("rejects a tampered token", async () => {
    const token = await createSessionToken({ id: "user_abc123", username: "alice" })
    const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a")
    await expect(verifySessionToken(tampered)).resolves.toBeNull()
  })

  it("rejects garbage input", async () => {
    await expect(verifySessionToken("not-a-jwt")).resolves.toBeNull()
  })

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken({ id: "user_abc123", username: "alice" })
    process.env.JWT_SECRET = "a-completely-different-secret"
    await expect(verifySessionToken(token)).resolves.toBeNull()
  })

  it("throws when JWT_SECRET is not set", () => {
    delete process.env.JWT_SECRET
    expect(() => createSessionToken({ id: "user_abc123", username: "alice" })).toThrow("JWT_SECRET")
  })
})
