import type Database from "better-sqlite3"
import { getVaultDb } from "./vault-db.server"

export type CaptureStatus = "pending" | "complete" | "failed"
export type AttachmentKind = "file" | "screenshot" | "archive" | "metadata"
export type DocumentStatus = "pending" | "active"

export interface NewDocumentInput {
  id: string
  userId: string
  title: string
  description: string
  sourceUrl: string | null
  status: DocumentStatus
}

export interface NewAttachmentInput {
  id: string
  documentId: string
  kind: AttachmentKind
  status: CaptureStatus
  cid: string | null
  fileName: string
  mimeType: string
  fileSize: number | null
}

export interface AttachmentRecord {
  id: string
  documentId: string
  kind: AttachmentKind
  status: CaptureStatus
  cid: string | null
  fileName: string
  mimeType: string
  fileSize: number | null
  createdAt: string
}

export interface DocumentRecord {
  id: string
  userId: string
  title: string
  description: string
  sourceUrl: string | null
  createdAt: string
  status: DocumentStatus
  deletedAt: string | null
  tags: string[]
  attachments: AttachmentRecord[]
}

interface DocumentRow {
  id: string
  user_id: string
  title: string
  description: string
  source_url: string | null
  created_at: string
  status: DocumentStatus
  deleted_at: string | null
}

interface AttachmentRow {
  id: string
  document_id: string
  kind: AttachmentKind
  status: CaptureStatus
  cid: string | null
  file_name: string
  mime_type: string
  file_size: number | null
  created_at: string
}

function rowToAttachment(row: AttachmentRow): AttachmentRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    kind: row.kind,
    status: row.status,
    cid: row.cid,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }
}

function rowToDocument(row: DocumentRow, tags: string[], attachments: AttachmentRecord[]): DocumentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    status: row.status,
    deletedAt: row.deleted_at,
    tags,
    attachments,
  }
}

export function insertDocument(input: NewDocumentInput, db?: Database.Database): void {
  db ??= getVaultDb()
  db.prepare(
    `INSERT INTO documents (id, user_id, title, description, source_url, status) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(input.id, input.userId, input.title, input.description, input.sourceUrl, input.status)
}

// Called once background capture (or, when there's none, document creation
// itself) has settled — success or failure, since each attachment already
// carries its own status for that. Idempotent no-op if already active.
export function markDocumentActive(id: string, db?: Database.Database): void {
  db ??= getVaultDb()
  db.prepare("UPDATE documents SET status = 'active' WHERE id = ?").run(id)
}

// Soft delete: the row (and its DB-recorded association with any IPFS
// content) stays for audit purposes, but every read query below excludes it.
// Idempotent — deleting an already-deleted document is a no-op.
export function markDocumentDeleted(id: string, db?: Database.Database): void {
  db ??= getVaultDb()
  db.prepare(
    "UPDATE documents SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND deleted_at IS NULL",
  ).run(id)
}

export function insertDocumentTags(documentId: string, tags: string[], db?: Database.Database): void {
  if (tags.length === 0) return
  db ??= getVaultDb()
  const insert = db.prepare("INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?, ?)")
  const insertAll = db.transaction((values: string[]) => {
    for (const tag of values) insert.run(documentId, tag)
  })
  insertAll(tags)
}

export function insertAttachment(input: NewAttachmentInput, db?: Database.Database): void {
  db ??= getVaultDb()
  db.prepare(
    `INSERT INTO attachments (id, document_id, kind, status, cid, file_name, mime_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.documentId,
    input.kind,
    input.status,
    input.cid,
    input.fileName,
    input.mimeType,
    input.fileSize,
  )
}

export function updateAttachment(
  id: string,
  patch: Partial<{ cid: string; status: CaptureStatus; fileSize: number }>,
  db?: Database.Database,
): void {
  db ??= getVaultDb()
  const columns: string[] = []
  const values: (string | number)[] = []
  if (patch.cid !== undefined) {
    columns.push("cid = ?")
    values.push(patch.cid)
  }
  if (patch.status !== undefined) {
    columns.push("status = ?")
    values.push(patch.status)
  }
  if (patch.fileSize !== undefined) {
    columns.push("file_size = ?")
    values.push(patch.fileSize)
  }
  if (columns.length === 0) return
  db.prepare(`UPDATE attachments SET ${columns.join(", ")} WHERE id = ?`).run(...values, id)
}

function tagsByDocumentId(documentIds: string[], db: Database.Database): Map<string, string[]> {
  const tagsByDoc = new Map<string, string[]>()
  if (documentIds.length === 0) return tagsByDoc
  const placeholders = documentIds.map(() => "?").join(", ")
  const rows = db
    .prepare(`SELECT document_id, tag FROM document_tags WHERE document_id IN (${placeholders}) ORDER BY tag`)
    .all(...documentIds) as { document_id: string; tag: string }[]
  for (const row of rows) {
    const existing = tagsByDoc.get(row.document_id)
    if (existing) {
      existing.push(row.tag)
    } else {
      tagsByDoc.set(row.document_id, [row.tag])
    }
  }
  return tagsByDoc
}

function attachmentsByDocumentId(documentIds: string[], db: Database.Database): Map<string, AttachmentRecord[]> {
  const attachmentsByDoc = new Map<string, AttachmentRecord[]>()
  if (documentIds.length === 0) return attachmentsByDoc
  const placeholders = documentIds.map(() => "?").join(", ")
  const rows = db
    .prepare(`SELECT * FROM attachments WHERE document_id IN (${placeholders}) ORDER BY created_at`)
    .all(...documentIds) as AttachmentRow[]
  for (const row of rows) {
    const attachment = rowToAttachment(row)
    const existing = attachmentsByDoc.get(row.document_id)
    if (existing) {
      existing.push(attachment)
    } else {
      attachmentsByDoc.set(row.document_id, [attachment])
    }
  }
  return attachmentsByDoc
}

export function listDocuments(db?: Database.Database): DocumentRecord[] {
  db ??= getVaultDb()
  const rows = db
    .prepare("SELECT * FROM documents WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all() as DocumentRow[]
  const ids = rows.map((r) => r.id)
  const tagsByDoc = tagsByDocumentId(ids, db)
  const attachmentsByDoc = attachmentsByDocumentId(ids, db)
  return rows.map((row) => rowToDocument(row, tagsByDoc.get(row.id) ?? [], attachmentsByDoc.get(row.id) ?? []))
}

export function searchDocumentsByTag(tag: string, db?: Database.Database): DocumentRecord[] {
  db ??= getVaultDb()
  const rows = db
    .prepare(
      `SELECT DISTINCT documents.* FROM documents
       JOIN document_tags ON document_tags.document_id = documents.id
       WHERE documents.deleted_at IS NULL AND document_tags.tag LIKE ? ESCAPE '\\'
       ORDER BY documents.created_at DESC`,
    )
    .all(`%${tag.replace(/[\\%_]/g, (c) => `\\${c}`)}%`) as DocumentRow[]
  const ids = rows.map((r) => r.id)
  const tagsByDoc = tagsByDocumentId(ids, db)
  const attachmentsByDoc = attachmentsByDocumentId(ids, db)
  return rows.map((row) => rowToDocument(row, tagsByDoc.get(row.id) ?? [], attachmentsByDoc.get(row.id) ?? []))
}

export function getDocument(id: string, db?: Database.Database): DocumentRecord | null {
  db ??= getVaultDb()
  const row = db.prepare("SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL").get(id) as
    | DocumentRow
    | undefined
  if (!row) return null
  const tagsByDoc = tagsByDocumentId([id], db)
  const attachmentsByDoc = attachmentsByDocumentId([id], db)
  return rowToDocument(row, tagsByDoc.get(id) ?? [], attachmentsByDoc.get(id) ?? [])
}
