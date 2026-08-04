import { describe, expect, it } from "vitest"
import { hashPassword, verifyPassword } from "./password.server"

describe("password.server", () => {
  it("hashes a password to something other than the plaintext", async () => {
    const hash = await hashPassword("correcthorsebattery")
    expect(hash).not.toBe("correcthorsebattery")
    expect(hash).toMatch(/^\$2[aby]\$/)
  })

  it("verifies a matching password", async () => {
    const hash = await hashPassword("correcthorsebattery")
    await expect(verifyPassword("correcthorsebattery", hash)).resolves.toBe(true)
  })

  it("rejects a non-matching password", async () => {
    const hash = await hashPassword("correcthorsebattery")
    await expect(verifyPassword("wrongpassword", hash)).resolves.toBe(false)
  })

  it("produces a different hash each time (random salt)", async () => {
    const [a, b] = await Promise.all([hashPassword("correcthorsebattery"), hashPassword("correcthorsebattery")])
    expect(a).not.toBe(b)
  })
})
