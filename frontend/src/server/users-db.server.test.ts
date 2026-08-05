import type Database from "better-sqlite3"
import { beforeEach, describe, expect, it } from "vitest"
import {
  createUsersDb,
  deleteTakedownRequestsForDocument,
  insertTakedownAttachment,
  insertTakedownRequest,
  isUserAdmin,
  listTakedownRequests,
} from "./users-db.server"

describe("users-db.server", () => {
  let db: Database.Database

  beforeEach(() => {
    db = createUsersDb(":memory:")
  })

  function seedUser(id: string, isAdmin = false) {
    db.prepare(
      "INSERT INTO users (id, username, email, password_hash, is_admin) VALUES (?, ?, ?, 'hash', ?)",
    ).run(id, `user_${id}`, `${id}@example.com`, isAdmin ? 1 : 0)
  }

  it("defaults new users to non-admin", () => {
    seedUser("user_1")
    expect(isUserAdmin("user_1", db)).toBe(false)
  })

  it("recognizes a user manually promoted to admin", () => {
    seedUser("user_1", true)
    expect(isUserAdmin("user_1", db)).toBe(true)
  })

  it("treats an unknown user id as non-admin", () => {
    expect(isUserAdmin("user_missing", db)).toBe(false)
  })

  it("records a takedown request and its evidence attachments", () => {
    insertTakedownRequest({ id: "takedown_1", documentId: "doc_1", message: "this is my info" }, db)
    insertTakedownAttachment(
      {
        id: "takedownatt_1",
        takedownRequestId: "takedown_1",
        cid: "bafyevidence",
        fileName: "id-card.jpg",
        mimeType: "image/jpeg",
        fileSize: 999,
      },
      db,
    )

    const request = db.prepare("SELECT * FROM takedown_requests WHERE id = ?").get("takedown_1") as {
      document_id: string
      message: string
    }
    expect(request).toMatchObject({ document_id: "doc_1", message: "this is my info" })

    const attachment = db.prepare("SELECT * FROM takedown_attachments WHERE id = ?").get("takedownatt_1") as {
      takedown_request_id: string
      cid: string
      file_name: string
    }
    expect(attachment).toMatchObject({ takedown_request_id: "takedown_1", cid: "bafyevidence", file_name: "id-card.jpg" })
  })

  it("cascade-deletes evidence attachments when their takedown request is deleted", () => {
    insertTakedownRequest({ id: "takedown_1", documentId: "doc_1", message: "please remove" }, db)
    insertTakedownAttachment(
      {
        id: "takedownatt_1",
        takedownRequestId: "takedown_1",
        cid: "bafyevidence",
        fileName: "evidence.png",
        mimeType: "image/png",
        fileSize: 10,
      },
      db,
    )

    db.prepare("DELETE FROM takedown_requests WHERE id = ?").run("takedown_1")

    const remaining = db.prepare("SELECT COUNT(*) as count FROM takedown_attachments").get() as { count: number }
    expect(remaining.count).toBe(0)
  })

  it("lists takedown requests newest-first with their attachments nested", () => {
    insertTakedownRequest({ id: "takedown_1", documentId: "doc_1", message: "first" }, db)
    insertTakedownRequest({ id: "takedown_2", documentId: "doc_2", message: "second" }, db)
    insertTakedownAttachment(
      {
        id: "takedownatt_1",
        takedownRequestId: "takedown_1",
        cid: "bafyevidence",
        fileName: "evidence.png",
        mimeType: "image/png",
        fileSize: 10,
      },
      db,
    )

    const requests = listTakedownRequests(db)
    expect(requests.map((r) => r.id)).toEqual(["takedown_2", "takedown_1"])
    expect(requests.find((r) => r.id === "takedown_1")?.attachments).toEqual([
      expect.objectContaining({ id: "takedownatt_1", cid: "bafyevidence", fileName: "evidence.png" }),
    ])
    expect(requests.find((r) => r.id === "takedown_2")?.attachments).toEqual([])
  })

  it("deletes every takedown request for a document and returns its evidence cids", () => {
    insertTakedownRequest({ id: "takedown_1", documentId: "doc_1", message: "first" }, db)
    insertTakedownRequest({ id: "takedown_2", documentId: "doc_1", message: "second" }, db)
    insertTakedownRequest({ id: "takedown_3", documentId: "doc_2", message: "unrelated" }, db)
    insertTakedownAttachment(
      { id: "takedownatt_1", takedownRequestId: "takedown_1", cid: "bafy1", fileName: "a.png", mimeType: "image/png", fileSize: 1 },
      db,
    )
    insertTakedownAttachment(
      { id: "takedownatt_2", takedownRequestId: "takedown_2", cid: "bafy2", fileName: "b.png", mimeType: "image/png", fileSize: 1 },
      db,
    )
    insertTakedownAttachment(
      { id: "takedownatt_3", takedownRequestId: "takedown_2", cid: null, fileName: "c.png", mimeType: "image/png", fileSize: 1 },
      db,
    )

    const cids = deleteTakedownRequestsForDocument("doc_1", db)

    expect(cids.sort()).toEqual(["bafy1", "bafy2"])
    expect(listTakedownRequests(db).map((r) => r.id)).toEqual(["takedown_3"])
  })
})
