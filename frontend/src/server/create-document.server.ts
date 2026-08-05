import { addBytesToIpfs, mfsCp, mfsMkdirP } from "./ipfs.server"
import { generateAttachmentId, generateDocumentId } from "./id.server"
import { extractHashtags } from "../utils/hashtags"
import { captureAndStore } from "./capture.server"
import { getDocument, insertAttachment, insertDocument, insertDocumentTags } from "./documents-db.server"
import type { DocumentRecord, NewAttachmentInput } from "./documents-db.server"

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

export class CreateDocumentError extends Error {
  code: "invalid" | "storage_unavailable"

  constructor(message: string, code: "invalid" | "storage_unavailable" = "invalid") {
    super(message)
    this.code = code
  }
}

export interface CreateDocumentInput {
  userId: string
  title: string
  description: string
  sourceUrl: string
  file: File | null
}

function validateSourceUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new CreateDocumentError("source URL must be a valid URL")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CreateDocumentError("source URL must use http or https")
  }
  return parsed.toString()
}

// Uploads + places the file in MFS before anything is written to the
// database, so a storage failure never leaves a document row with a
// missing/broken file attachment.
async function uploadFileAttachment(documentId: string, file: File): Promise<NewAttachmentInput> {
  const fileName = file.name || "file"
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const { cid } = await addBytesToIpfs(bytes, fileName)
    await mfsMkdirP(`/document/${documentId}`)
    await mfsCp(cid, `/document/${documentId}/${fileName}`)
    return {
      id: generateAttachmentId(),
      documentId,
      kind: "file",
      status: "complete",
      cid,
      fileName,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    }
  } catch (err) {
    console.error(`failed to store file for document ${documentId}:`, err)
    throw new CreateDocumentError("the vault is temporarily unavailable — try again shortly", "storage_unavailable")
  }
}

// Best-effort — the database row is the source of truth, this file is a
// convenience export of it. A hiccup here shouldn't fail document creation.
// Returns null on failure so the caller can skip recording an attachment for
// a file that was never actually written.
async function writeMetadataFile(documentId: string, document: DocumentRecord): Promise<NewAttachmentInput | null> {
  const fileName = `${documentId}.metadata`
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(document, null, 2))
    const { cid } = await addBytesToIpfs(bytes, fileName)
    await mfsMkdirP(`/document/${documentId}`)
    await mfsCp(cid, `/document/${documentId}/${fileName}`)
    return {
      id: generateAttachmentId(),
      documentId,
      kind: "metadata",
      status: "complete",
      cid,
      fileName,
      mimeType: "application/json",
      fileSize: bytes.length,
    }
  } catch (err) {
    console.error(`failed to write metadata file for document ${documentId}:`, err)
    return null
  }
}

export async function createDocument(input: CreateDocumentInput): Promise<DocumentRecord> {
  const title = input.title.trim()
  const description = input.description.trim()

  if (!title) {
    throw new CreateDocumentError("title is required")
  }

  const file = input.file && input.file.size > 0 ? input.file : null
  if (file && file.size > MAX_FILE_SIZE_BYTES) {
    throw new CreateDocumentError("file must be 100MB or smaller")
  }

  const sourceUrl = validateSourceUrl(input.sourceUrl)
  const id = generateDocumentId()

  const fileAttachment = file ? await uploadFileAttachment(id, file) : null

  insertDocument({ id, userId: input.userId, title, description, sourceUrl })
  insertDocumentTags(id, extractHashtags(description))
  if (fileAttachment) {
    insertAttachment(fileAttachment)
  }

  let screenshotAttachmentId: string | null = null
  let archiveAttachmentId: string | null = null
  if (sourceUrl) {
    screenshotAttachmentId = generateAttachmentId()
    archiveAttachmentId = generateAttachmentId()
    insertAttachment({
      id: screenshotAttachmentId,
      documentId: id,
      kind: "screenshot",
      status: "pending",
      cid: null,
      fileName: "screenshot.png",
      mimeType: "image/png",
      fileSize: null,
    })
    insertAttachment({
      id: archiveAttachmentId,
      documentId: id,
      kind: "archive",
      status: "pending",
      cid: null,
      fileName: "archive.mhtml",
      // MHTML's registered content type per RFC 2557.
      mimeType: "multipart/related",
      fileSize: null,
    })
  }

  const document = getDocument(id)
  if (!document) {
    throw new Error(`document ${id} not found immediately after insert`)
  }

  const metadataAttachment = await writeMetadataFile(id, document)
  if (metadataAttachment) {
    insertAttachment(metadataAttachment)
  }

  if (sourceUrl && screenshotAttachmentId && archiveAttachmentId) {
    // Fire-and-forget: the document is already created and returned to the
    // caller, capture fills in the screenshot/archive attachments
    // asynchronously. captureAndStore never rejects, but guard anyway since
    // this promise is intentionally unawaited.
    void captureAndStore(id, sourceUrl, screenshotAttachmentId, archiveAttachmentId).catch((err) =>
      console.error(`capture failed for document ${id}:`, err),
    )
  }

  return document
}
