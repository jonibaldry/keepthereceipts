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
  CREATE INDEX IF NOT EXISTS idx_takedown_requests_created_at ON takedown_requests(created_at);

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

export interface TakedownAttachmentRecord {
  id: string
  takedownRequestId: string
  cid: string | null
  fileName: string
  mimeType: string
  fileSize: number | null
  createdAt: string
}

export interface TakedownRequestRecord {
  id: string
  documentId: string
  message: string
  createdAt: string
  attachments: TakedownAttachmentRecord[]
}

interface TakedownRequestRow {
  id: string
  document_id: string
  message: string
  created_at: string
}

interface TakedownAttachmentRow {
  id: string
  takedown_request_id: string
  cid: string | null
  file_name: string
  mime_type: string
  file_size: number | null
  created_at: string
}

function rowToTakedownAttachment(row: TakedownAttachmentRow): TakedownAttachmentRecord {
  return {
    id: row.id,
    takedownRequestId: row.takedown_request_id,
    cid: row.cid,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }
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

// Admin-only read path (see requireAdmin in the takedown review server
// function) — every open takedown request, newest first, with its evidence
// attachments nested underneath.
export function listTakedownRequests(db?: Database.Database): TakedownRequestRecord[] {
  db ??= getUsersDb()
  const requests = db.prepare("SELECT * FROM takedown_requests ORDER BY created_at DESC").all() as TakedownRequestRow[]
  const ids = requests.map((r) => r.id)
  const attachmentsByRequest = new Map<string, TakedownAttachmentRecord[]>()
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(", ")
    const rows = db
      .prepare(
        `SELECT * FROM takedown_attachments WHERE takedown_request_id IN (${placeholders}) ORDER BY created_at`,
      )
      .all(...ids) as TakedownAttachmentRow[]
    for (const row of rows) {
      const attachment = rowToTakedownAttachment(row)
      const existing = attachmentsByRequest.get(row.takedown_request_id)
      if (existing) {
        existing.push(attachment)
      } else {
        attachmentsByRequest.set(row.takedown_request_id, [attachment])
      }
    }
  }
  return requests.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    message: row.message,
    createdAt: row.created_at,
    attachments: attachmentsByRequest.get(row.id) ?? [],
  }))
}

// Called when a document is deleted (whether via takedown approval or a
// plain admin delete — see delete-document.server.ts) so no stale request
// is left pointing at a document that no longer exists. Returns the cids of
// every evidence attachment that was just cascade-deleted, so the caller
// can unpin them from IPFS.
export function deleteTakedownRequestsForDocument(documentId: string, db?: Database.Database): string[] {
  db ??= getUsersDb()
  const rows = db
    .prepare(
      `SELECT takedown_attachments.cid FROM takedown_attachments
       JOIN takedown_requests ON takedown_requests.id = takedown_attachments.takedown_request_id
       WHERE takedown_requests.document_id = ?`,
    )
    .all(documentId) as { cid: string | null }[]
  db.prepare("DELETE FROM takedown_requests WHERE document_id = ?").run(documentId)
  return rows.map((r) => r.cid).filter((cid): cid is string => cid !== null)
}
