import { addBytesToIpfs, mfsCp, mfsMkdirP } from "./ipfs.server"
import { generateAttachmentId, generateDocumentId } from "./id.server"
import { extractHashtags } from "../utils/hashtags"
import { captureAndStore } from "./capture.server"
import { assertPublicHostname, UnsafeUrlError } from "./network-guard.server"
import { safeFileName } from "./safe-filename.server"
import {
  getDocument,
  insertAttachment,
  insertDocument,
  insertDocumentTags,
  markDocumentActive,
} from "./documents-db.server"
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

// This is a fast, user-facing rejection for the obvious case (an internal
// address typed directly into the sourceUrl field) — it is NOT the actual
// SSRF defense. A page at an otherwise-public URL can still embed a
// resource (an <img>, an <iframe>) pointing at an internal address, so the
// real enforcement is per-request during capture; see capture.server.ts.
async function validateSourceUrl(raw: string): Promise<string | null> {
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
  try {
    await assertPublicHostname(parsed.hostname)
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      throw new CreateDocumentError("source URL must not point to a private or internal address")
    }
    throw err
  }
  return parsed.toString()
}

// Uploads + places the file in MFS before anything is written to the
// database, so a storage failure never leaves a document row with a
// missing/broken file attachment.
async function uploadFileAttachment(documentId: string, file: File): Promise<NewAttachmentInput> {
  const fileName = safeFileName(file.name || "file")
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const { cid } = await addBytesToIpfs(bytes, fileName)
    await mfsMkdirP(`/vault/document/${documentId}`)
    await mfsCp(cid, `/vault/document/${documentId}/${fileName}`)
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

// Augments each attachment with an `ipfs://` URI so the exported metadata
// file is a self-contained pointer to everything belonging to the document,
// not just this JSON blob itself.
function withIpfsLinks(document: DocumentRecord) {
  return {
    ...document,
    attachments: document.attachments.map((attachment) => ({
      ...attachment,
      ipfsUri: attachment.cid ? `ipfs://${attachment.cid}` : null,
    })),
  }
}

// Best-effort — the database row is the source of truth, this file is a
// convenience export of it. A hiccup here shouldn't fail document creation.
// Returns null on failure so the caller can skip recording an attachment for
// a file that was never actually written.
async function writeMetadataFile(documentId: string, document: DocumentRecord): Promise<NewAttachmentInput | null> {
  // No need to repeat the document id in the filename — it's already the
  // enclosing MFS folder.
  const fileName = "metadata.json"
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(withIpfsLinks(document), null, 2))
    const { cid } = await addBytesToIpfs(bytes, fileName)
    await mfsMkdirP(`/vault/document/${documentId}`)
    await mfsCp(cid, `/vault/document/${documentId}/${fileName}`)
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

// Fire-and-forget follow-up once a document with a source URL has been
// returned to the caller: waits for the screenshot/archive capture to
// settle, then writes the metadata file so it can include ipfs links for
// every attachment in its final state, not just the ones ready at creation.
async function captureAndWriteMetadata(
  documentId: string,
  sourceUrl: string,
  screenshotAttachmentId: string,
  archiveAttachmentId: string,
): Promise<void> {
  // captureAndStore never rejects, but guard anyway since we're not
  // propagating this failure to any caller.
  await captureAndStore(documentId, sourceUrl, screenshotAttachmentId, archiveAttachmentId).catch((err) =>
    console.error(`capture failed for document ${documentId}:`, err),
  )
  // "active" means the background work has settled, not that it succeeded —
  // each attachment's own status carries success/failure.
  markDocumentActive(documentId)
  const document = getDocument(documentId)
  if (!document) return
  const metadataAttachment = await writeMetadataFile(documentId, document)
  if (metadataAttachment) {
    insertAttachment(metadataAttachment)
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

  const sourceUrl = await validateSourceUrl(input.sourceUrl)
  const id = generateDocumentId()

  const fileAttachment = file ? await uploadFileAttachment(id, file) : null

  insertDocument({ id, userId: input.userId, title, description, sourceUrl, status: "pending" })
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

  if (sourceUrl && screenshotAttachmentId && archiveAttachmentId) {
    // Fire-and-forget: the document is already created and returned to the
    // caller. Capture fills in the screenshot/archive attachments in the
    // background, and the metadata file is written only once that's done
    // (see captureAndWriteMetadata) so it can link to their final cids —
    // markDocumentActive happens there too, once that background work
    // settles.
    void captureAndWriteMetadata(id, sourceUrl, screenshotAttachmentId, archiveAttachmentId)
  } else {
    // No background capture to wait for — every attachment is already in
    // its final state, so the document is active immediately.
    markDocumentActive(id)
  }

  const document = getDocument(id)
  if (!document) {
    throw new Error(`document ${id} not found immediately after insert`)
  }

  if (!sourceUrl) {
    const metadataAttachment = await writeMetadataFile(id, document)
    if (metadataAttachment) {
      insertAttachment(metadataAttachment)
    }
  }

  return document
}
