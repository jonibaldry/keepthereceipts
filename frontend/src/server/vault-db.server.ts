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
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
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
  return db
}

let db: Database.Database | undefined

export function getVaultDb(): Database.Database {
  if (!db) {
    db = createVaultDb(process.env.DB_PATH || "../data/db/vault.db")
  }
  return db
}
