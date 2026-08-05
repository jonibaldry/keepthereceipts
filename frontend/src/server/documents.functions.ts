import { createServerFn } from "@tanstack/react-start"
import { createDocument as createDocumentRecord, CreateDocumentError } from "./create-document.server"
import { deleteDocument as deleteDocumentRecord, DeleteDocumentError } from "./delete-document.server"
import {
  getDocument as getDocumentRecord,
  listDocuments as listDocumentRecords,
  searchDocumentsByTag as searchDocumentsByTagRecords,
} from "./documents-db.server"
import { readSessionUser } from "./session.server"
import { assertSameOrigin } from "./same-origin.server"
import { isUserAdmin } from "./users-db.server"
import type { DocumentRecord } from "./documents-db.server"

export type CreateDocumentResult = { ok: true; document: DocumentRecord } | { ok: false; message: string }

export type DeleteDocumentResult = { ok: true } | { ok: false; message: string }

interface CreateDocumentFormInput {
  title: string
  description: string
  sourceUrl: string
  file: File | null
}

export const createDocument = createServerFn({ method: "POST" })
  .validator((data: unknown): CreateDocumentFormInput => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected FormData")
    }
    // A file input with nothing chosen still appends an empty File (name:
    // "", size: 0) to FormData rather than omitting the field — treat that
    // the same as "no file" rather than as a zero-byte upload.
    const fileEntry = data.get("file")
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null
    return {
      title: data.get("title")?.toString() ?? "",
      description: data.get("description")?.toString() ?? "",
      sourceUrl: data.get("sourceUrl")?.toString() ?? "",
      file,
    }
  })
  .handler(async ({ data }): Promise<CreateDocumentResult> => {
    assertSameOrigin()
    const user = await readSessionUser()
    if (!user) {
      return { ok: false, message: "you must be logged in to add a document" }
    }
    try {
      const document = await createDocumentRecord({ ...data, userId: user.id })
      return { ok: true, document }
    } catch (err) {
      if (err instanceof CreateDocumentError) {
        return { ok: false, message: err.message }
      }
      throw err
    }
  })

export const listDocuments = createServerFn({ method: "GET" }).handler(
  async (): Promise<DocumentRecord[]> => listDocumentRecords(),
)

export const getDocument = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<DocumentRecord | null> => getDocumentRecord(data.id))

export const searchDocumentsByTag = createServerFn({ method: "GET" })
  .validator((data: { tag: string }) => data)
  .handler(async ({ data }): Promise<DocumentRecord[]> => {
    const tag = data.tag.trim()
    if (!tag) return []
    return searchDocumentsByTagRecords(tag)
  })

export const deleteDocument = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<DeleteDocumentResult> => {
    assertSameOrigin()
    const user = await readSessionUser()
    if (!user) {
      return { ok: false, message: "you must be logged in to do that" }
    }
    if (!isUserAdmin(user.id)) {
      return { ok: false, message: "admin access is required to delete a document" }
    }
    try {
      await deleteDocumentRecord(data.id)
      return { ok: true }
    } catch (err) {
      if (err instanceof DeleteDocumentError) {
        return { ok: false, message: err.message }
      }
      throw err
    }
  })
