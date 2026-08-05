import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import Database from "better-sqlite3"

const VAULT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    source_url TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    status TEXT NOT NULL DEFAULT 'active',
    deleted_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
  CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

  CREATE TABLE IF NOT EXISTS document_tags (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (document_id, tag)
  );

  CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);

  -- Every file that belongs to a document: the user-uploaded original
  -- ('file'), plus a best-effort 'screenshot' and 'archive' when the
  -- document has a source_url. mime_type is always populated (never
  -- inferred at render time) so every consumer of this table can trust it.
  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'complete',
    cid TEXT,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_attachments_document_id ON attachments(document_id);
`

// attachments.status: 'pending' (capture running in the background) |
// 'complete' | 'failed'. The user-uploaded 'file' attachment is always
// inserted already 'complete' since it's stored synchronously; 'screenshot'
// and 'archive' start 'pending' and are filled in independently, since one
// can succeed while the other fails.

// documents.status: 'pending' (still waiting on background screenshot/
// archive capture) | 'active' (either there was nothing to wait on, or
// capture has settled — successfully or not, see documents-db.server.ts).
// documents.deleted_at: null unless an admin has deleted the document, in
// which case it's a timestamp and the row is treated as gone everywhere
// except direct DB inspection — see markDocumentDeleted.

// Column additions after the initial release: existing on-disk databases
// were created before `status`/`deleted_at` existed, and CREATE TABLE IF NOT
// EXISTS is a no-op against them, so a fresh install and an upgrade must
// both end up with the same columns. New rows default to 'active' at the
// table level only as a safety net — insertDocument always passes an
// explicit status, so this default is only ever observed by a migrated
// pre-existing row.
function migrateVaultDb(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(documents)").all() as { name: string }[]
  const columnNames = new Set(columns.map((c) => c.name))
  if (!columnNames.has("status")) {
    db.exec("ALTER TABLE documents ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
  }
  if (!columnNames.has("deleted_at")) {
    db.exec("ALTER TABLE documents ADD COLUMN deleted_at TEXT")
  }
}

// Exported for tests, which want an isolated (usually :memory:) db rather
// than the process-wide singleton below.
export function createVaultDb(path: string): Database.Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true })
  }
  const db = new Database(path)
  if (path !== ":memory:") {
    db.pragma("journal_mode = WAL")
  }
  db.pragma("foreign_keys = ON")
  db.exec(VAULT_SCHEMA)
  migrateVaultDb(db)
  return db
}

let db: Database.Database | undefined

export function getVaultDb(): Database.Database {
  if (!db) {
    db = createVaultDb(process.env.DB_PATH || "../data/db/vault.db")
  }
  return db
}
