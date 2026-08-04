import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import Database from "better-sqlite3"

const USERS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )
`

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
  return db
}

let db: Database.Database | undefined

export function getUsersDb(): Database.Database {
  if (!db) {
    db = createUsersDb(process.env.USERS_DB_PATH || "./data/users.db")
  }
  return db
}
