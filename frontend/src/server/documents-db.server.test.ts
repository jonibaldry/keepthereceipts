import type Database from "better-sqlite3"
import { beforeEach, describe, expect, it } from "vitest"
import { createVaultDb } from "./vault-db.server"
import {
  getDocument,
  insertAttachment,
  insertDocument,
  insertDocumentTags,
  listDocuments,
  updateAttachment,
} from "./documents-db.server"

describe("documents-db.server", () => {
  let db: Database.Database

  beforeEach(() => {
    db = createVaultDb(":memory:")
  })

  function seedDocument(id: string, overrides: Partial<Parameters<typeof insertDocument>[0]> = {}) {
    insertDocument(
      {
        id,
        userId: "user_1",
        title: `Document ${id}`,
        description: "a description",
        sourceUrl: null,
        ...overrides,
      },
      db,
    )
  }

  function seedFileAttachment(id: string, documentId: string) {
    insertAttachment(
      {
        id,
        documentId,
        kind: "file",
        status: "complete",
        cid: "bafyfile",
        fileName: "receipt.pdf",
        mimeType: "application/pdf",
        fileSize: 1234,
      },
      db,
    )
  }

  it("inserts and retrieves a document with no tags or attachments", () => {
    seedDocument("doc_1")
    const doc = getDocument("doc_1", db)
    expect(doc).toMatchObject({ id: "doc_1", title: "Document doc_1", tags: [], attachments: [] })
  })

  it("returns null for an unknown document", () => {
    expect(getDocument("doc_missing", db)).toBeNull()
  })

  it("attaches tags to a document", () => {
    seedDocument("doc_1")
    insertDocumentTags("doc_1", ["utilities", "home"], db)
    const doc = getDocument("doc_1", db)
    expect(doc?.tags).toEqual(["home", "utilities"])
  })

  it("ignores duplicate tag inserts", () => {
    seedDocument("doc_1")
    insertDocumentTags("doc_1", ["utilities"], db)
    insertDocumentTags("doc_1", ["utilities"], db)
    expect(getDocument("doc_1", db)?.tags).toEqual(["utilities"])
  })

  it("attaches a file attachment to a document with a mime type", () => {
    seedDocument("doc_1")
    seedFileAttachment("att_1", "doc_1")

    const doc = getDocument("doc_1", db)
    expect(doc?.attachments).toEqual([
      {
        id: "att_1",
        documentId: "doc_1",
        kind: "file",
        status: "complete",
        cid: "bafyfile",
        fileName: "receipt.pdf",
        mimeType: "application/pdf",
        fileSize: 1234,
        createdAt: expect.any(String),
      },
    ])
  })

  it("lists documents most-recent-first with tags and attachments attached", () => {
    seedDocument("doc_1")
    seedDocument("doc_2")
    insertDocumentTags("doc_2", ["receipt"], db)
    seedFileAttachment("att_1", "doc_2")

    const docs = listDocuments(db)
    expect(docs.map((d) => d.id)).toEqual(["doc_2", "doc_1"])
    expect(docs[0].tags).toEqual(["receipt"])
    expect(docs[0].attachments).toHaveLength(1)
    expect(docs[1].tags).toEqual([])
    expect(docs[1].attachments).toEqual([])
  })

  it("inserts pending screenshot/archive attachments with a mime type and no cid yet", () => {
    seedDocument("doc_1", { sourceUrl: "https://example.com" })
    insertAttachment(
      { id: "att_shot", documentId: "doc_1", kind: "screenshot", status: "pending", cid: null, fileName: "screenshot.png", mimeType: "image/png", fileSize: null },
      db,
    )
    insertAttachment(
      { id: "att_arch", documentId: "doc_1", kind: "archive", status: "pending", cid: null, fileName: "archive.mhtml", mimeType: "multipart/related", fileSize: null },
      db,
    )

    const doc = getDocument("doc_1", db)
    expect(doc?.attachments.map((a) => ({ kind: a.kind, status: a.status, mimeType: a.mimeType, cid: a.cid }))).toEqual([
      { kind: "screenshot", status: "pending", mimeType: "image/png", cid: null },
      { kind: "archive", status: "pending", mimeType: "multipart/related", cid: null },
    ])
  })

  it("updates an attachment's cid/status/size independently of other attachments", () => {
    seedDocument("doc_1", { sourceUrl: "https://example.com" })
    insertAttachment(
      { id: "att_shot", documentId: "doc_1", kind: "screenshot", status: "pending", cid: null, fileName: "screenshot.png", mimeType: "image/png", fileSize: null },
      db,
    )
    insertAttachment(
      { id: "att_arch", documentId: "doc_1", kind: "archive", status: "pending", cid: null, fileName: "archive.mhtml", mimeType: "multipart/related", fileSize: null },
      db,
    )

    updateAttachment("att_shot", { cid: "bafyshot", status: "complete", fileSize: 42 }, db)
    updateAttachment("att_arch", { status: "failed" }, db)

    const doc = getDocument("doc_1", db)
    const shot = doc?.attachments.find((a) => a.id === "att_shot")
    const arch = doc?.attachments.find((a) => a.id === "att_arch")
    expect(shot).toMatchObject({ cid: "bafyshot", status: "complete", fileSize: 42 })
    expect(arch).toMatchObject({ cid: null, status: "failed" })
  })
})
