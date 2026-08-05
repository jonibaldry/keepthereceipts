import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import Database from "better-sqlite3"

const USERS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    is_admin INTEGER NOT NULL DEFAULT 0
  )
`

// There's no admin UI yet — promote a user by setting is_admin = 1 for
// their row directly in the users db (e.g. `sqlite3 users.db "UPDATE users
// SET is_admin = 1 WHERE username = '...'"`).
function migrateUsersDb(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
  if (!columns.some((c) => c.name === "is_admin")) {
    db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
  }
}

// Exported for tests, which want an isolated (usually :memory:) db rather
// than the process-wide singleton below.
export function createUsersDb(path: string): Database.Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true })
  }
  const db = new Database(path)
  if (path !== ":memory:") {
    db.pragma("journal_mode = WAL")
  }
  db.exec(USERS_SCHEMA)
  migrateUsersDb(db)
  return db
}

// Re-checked fresh from the db on every call rather than trusted from a
// session token, so revoking admin access takes effect immediately instead
// of waiting for a stale 7-day JWT to expire.
export function isUserAdmin(userId: string, db?: Database.Database): boolean {
  db ??= getUsersDb()
  const row = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(userId) as
    | { is_admin: number }
    | undefined
  return row?.is_admin === 1
}

let db: Database.Database | undefined

export function getUsersDb(): Database.Database {
  if (!db) {
    db = createUsersDb(process.env.USERS_DB_PATH || "./data/users.db")
  }
  return db
}
