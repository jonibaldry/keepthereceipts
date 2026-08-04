import { beforeEach, describe, expect, it } from "vitest"
import type Database from "better-sqlite3"
import { createUsersDb } from "./users-db.server"
import { registerUser } from "./register-user.server"
import { loginUser, LoginError } from "./login-user.server"

describe("loginUser", () => {
  let db: Database.Database

  beforeEach(async () => {
    db = createUsersDb(":memory:")
    await registerUser({ username: "alice", email: "alice@example.com", password: "correcthorse" }, db)
  })

  it("logs in with the correct username and password", async () => {
    const user = await loginUser({ identifier: "alice", password: "correcthorse" }, db)
    expect(user.username).toBe("alice")
    expect(user.email).toBe("alice@example.com")
  })

  it("logs in with the correct email and password", async () => {
    const user = await loginUser({ identifier: "alice@example.com", password: "correcthorse" }, db)
    expect(user.username).toBe("alice")
  })

  it("rejects an incorrect password", async () => {
    await expect(loginUser({ identifier: "alice", password: "wrongpassword" }, db)).rejects.toBeInstanceOf(
      LoginError,
    )
  })

  it("rejects an unknown identifier", async () => {
    await expect(loginUser({ identifier: "nobody", password: "correcthorse" }, db)).rejects.toBeInstanceOf(
      LoginError,
    )
  })

  it("rejects missing credentials", async () => {
    await expect(loginUser({ identifier: "", password: "" }, db)).rejects.toBeInstanceOf(LoginError)
  })
})
