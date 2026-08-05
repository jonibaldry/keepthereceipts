import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import Database from "better-sqlite3"

// The app has exactly two database files: vault.db (public — periodically
// snapshotted whole into IPFS/MFS and published as the site's DNSLink root,
// see snapshot.sh and the warning atop vault-db.server.ts) and this one
// (private — never touched by the snapshotter). Anything that must not be
// published, however unrelated to user accounts, belongs here rather than
// in a third database file — see takedown_requests/takedown_attachments
// below, which hold takedown request messages and evidence submitted by
// (often anonymous, non-account-holding) requesters.
const USERS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    is_admin INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS takedown_requests (
    id TEXT PRIMARY KEY,
    -- Loose reference to documents.id in vault.db — a real foreign key
    -- isn't possible across separate database files.
    document_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_takedown_requests_document_id ON takedown_requests(document_id);

  CREATE TABLE IF NOT EXISTS takedown_attachments (
    id TEXT PRIMARY KEY,
    takedown_request_id TEXT NOT NULL REFERENCES takedown_requests(id) ON DELETE CASCADE,
    cid TEXT,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_takedown_attachments_request_id ON takedown_attachments(takedown_request_id);
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
  db.pragma("foreign_keys = ON")
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

export interface NewTakedownRequestInput {
  id: string
  documentId: string
  message: string
}

export interface NewTakedownAttachmentInput {
  id: string
  takedownRequestId: string
  cid: string | null
  fileName: string
  mimeType: string
  fileSize: number | null
}

export function insertTakedownRequest(input: NewTakedownRequestInput, db?: Database.Database): void {
  db ??= getUsersDb()
  db.prepare("INSERT INTO takedown_requests (id, document_id, message) VALUES (?, ?, ?)").run(
    input.id,
    input.documentId,
    input.message,
  )
}

export function insertTakedownAttachment(input: NewTakedownAttachmentInput, db?: Database.Database): void {
  db ??= getUsersDb()
  db.prepare(
    `INSERT INTO takedown_attachments (id, takedown_request_id, cid, file_name, mime_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(input.id, input.takedownRequestId, input.cid, input.fileName, input.mimeType, input.fileSize)
}
