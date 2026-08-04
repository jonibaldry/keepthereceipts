import type Database from "better-sqlite3"
import { getUsersDb } from "./users-db.server"
import { generateUserId } from "./id.server"
import { hashPassword } from "./password.server"

export class RegistrationError extends Error {
  code: "invalid" | "conflict"

  constructor(code: "invalid" | "conflict", message: string) {
    super(message)
    this.code = code
  }
}

interface RegisterInput {
  username: string
  email: string
  password: string
}

export interface RegisteredUser {
  id: string
  username: string
  email: string
}

export async function registerUser(input: RegisterInput, db?: Database.Database): Promise<RegisteredUser> {
  const username = input.username.trim()
  const email = input.email.trim().toLowerCase()
  const password = input.password

  if (!username || !email || !password) {
    throw new RegistrationError("invalid", "username, email, and password are all required")
  }
  if (password.length < 8) {
    throw new RegistrationError("invalid", "password must be at least 8 characters")
  }

  db ??= getUsersDb()
  const id = generateUserId()
  const passwordHash = await hashPassword(password)

  try {
    db.prepare("INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)").run(
      id,
      username,
      email,
      passwordHash,
    )
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
      throw new RegistrationError("conflict", "username or email is already taken")
    }
    throw err
  }

  return { id, username, email }
}
