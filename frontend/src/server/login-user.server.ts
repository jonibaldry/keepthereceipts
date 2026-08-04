import type Database from "better-sqlite3"
import { getUsersDb } from "./users-db.server"
import { verifyPassword } from "./password.server"

export class LoginError extends Error {}

interface LoginInput {
  identifier: string
  password: string
}

export interface LoggedInUser {
  id: string
  username: string
  email: string
}

interface UserRow {
  id: string
  username: string
  email: string
  password_hash: string
}

// A valid bcrypt hash with no matching password, used so a login attempt for
// a nonexistent account still runs bcrypt.compare — keeping response time
// consistent and not leaking whether the account exists.
const DUMMY_HASH = "$2b$12$qrrhFVCBSekJRwjl5K5rou2eA9r25ZJuk2/MbBOYQ8pHDjZy5Ayl."

export async function loginUser(input: LoginInput, db?: Database.Database): Promise<LoggedInUser> {
  const identifier = input.identifier.trim()
  const password = input.password

  if (!identifier || !password) {
    throw new LoginError("username/email and password are both required")
  }

  db ??= getUsersDb()
  const row = db
    .prepare("SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?")
    .get(identifier, identifier.toLowerCase()) as UserRow | undefined

  const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH)

  if (!row || !valid) {
    throw new LoginError("username/email or password is incorrect")
  }

  return { id: row.id, username: row.username, email: row.email }
}
