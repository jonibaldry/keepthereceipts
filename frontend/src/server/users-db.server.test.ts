import type Database from "better-sqlite3"
import { beforeEach, describe, expect, it } from "vitest"
import { createUsersDb, isUserAdmin } from "./users-db.server"

describe("users-db.server", () => {
  let db: Database.Database

  beforeEach(() => {
    db = createUsersDb(":memory:")
  })

  function seedUser(id: string, isAdmin = false) {
    db.prepare(
      "INSERT INTO users (id, username, email, password_hash, is_admin) VALUES (?, ?, ?, 'hash', ?)",
    ).run(id, `user_${id}`, `${id}@example.com`, isAdmin ? 1 : 0)
  }

  it("defaults new users to non-admin", () => {
    seedUser("user_1")
    expect(isUserAdmin("user_1", db)).toBe(false)
  })

  it("recognizes a user manually promoted to admin", () => {
    seedUser("user_1", true)
    expect(isUserAdmin("user_1", db)).toBe(true)
  })

  it("treats an unknown user id as non-admin", () => {
    expect(isUserAdmin("user_missing", db)).toBe(false)
  })
})
