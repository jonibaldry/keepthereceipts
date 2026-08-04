import { beforeEach, describe, expect, it } from "vitest"
import type Database from "better-sqlite3"
import { createUsersDb } from "./users-db.server"
import { registerUser, RegistrationError } from "./register-user.server"

describe("registerUser", () => {
  let db: Database.Database

  beforeEach(() => {
    db = createUsersDb(":memory:")
  })

  it("registers a user and returns their id/username/email", async () => {
    const user = await registerUser({ username: "alice", email: "Alice@Example.com", password: "correcthorse" }, db)
    expect(user.username).toBe("alice")
    expect(user.email).toBe("alice@example.com") // normalized to lowercase
    expect(user.id).toMatch(/^user_/)
  })

  it("stores a bcrypt hash, not the plaintext password", async () => {
    await registerUser({ username: "alice", email: "alice@example.com", password: "correcthorse" }, db)
    const row = db.prepare("SELECT password_hash FROM users WHERE username = ?").get("alice") as {
      password_hash: string
    }
    expect(row.password_hash).not.toBe("correcthorse")
    expect(row.password_hash).toMatch(/^\$2[aby]\$/)
  })

  it("rejects a duplicate username with a conflict error", async () => {
    await registerUser({ username: "alice", email: "alice@example.com", password: "correcthorse" }, db)
    await expect(
      registerUser({ username: "alice", email: "someone-else@example.com", password: "correcthorse" }, db),
    ).rejects.toMatchObject({ code: "conflict" })
  })

  it("rejects a duplicate email with a conflict error", async () => {
    await registerUser({ username: "alice", email: "alice@example.com", password: "correcthorse" }, db)
    await expect(
      registerUser({ username: "someone-else", email: "alice@example.com", password: "correcthorse" }, db),
    ).rejects.toMatchObject({ code: "conflict" })
  })

  it("rejects a password shorter than 8 characters", async () => {
    await expect(
      registerUser({ username: "alice", email: "alice@example.com", password: "short" }, db),
    ).rejects.toMatchObject({ code: "invalid" })
  })

  it.each([
    { username: "", email: "alice@example.com", password: "correcthorse" },
    { username: "alice", email: "", password: "correcthorse" },
    { username: "alice", email: "alice@example.com", password: "" },
  ])("rejects missing required fields (%o)", async (input) => {
    await expect(registerUser(input, db)).rejects.toBeInstanceOf(RegistrationError)
  })
})
