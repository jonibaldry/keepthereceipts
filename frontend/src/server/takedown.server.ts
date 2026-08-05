import { addBytesToIpfs } from "./ipfs.server"
import { generateAttachmentId, generateTakedownRequestId } from "./id.server"
import { safeFileName } from "./safe-filename.server"
import { getDocument, insertAttachment, insertTakedownRequest } from "./documents-db.server"

export const MAX_TAKEDOWN_FILE_SIZE_BYTES = 100 * 1024 * 1024
export const MAX_TAKEDOWN_FILES = 5
export const MAX_TAKEDOWN_MESSAGE_LENGTH = 5000

export class TakedownRequestError extends Error {}

export interface TakedownRequestInput {
  documentId: string
  message: string
  files: File[]
}

export async function createTakedownRequest(input: TakedownRequestInput): Promise<{ id: string }> {
  const message = input.message.trim()
  if (!message) {
    throw new TakedownRequestError("please describe why this document should be taken down")
  }
  if (message.length > MAX_TAKEDOWN_MESSAGE_LENGTH) {
    throw new TakedownRequestError(`message must be ${MAX_TAKEDOWN_MESSAGE_LENGTH} characters or fewer`)
  }

  const files = input.files.filter((file) => file.size > 0)
  if (files.length > MAX_TAKEDOWN_FILES) {
    throw new TakedownRequestError(`attach at most ${MAX_TAKEDOWN_FILES} files`)
  }
  for (const file of files) {
    if (file.size > MAX_TAKEDOWN_FILE_SIZE_BYTES) {
      throw new TakedownRequestError("each attached file must be 100MB or smaller")
    }
  }

  const document = getDocument(input.documentId)
  if (!document) {
    throw new TakedownRequestError("document not found")
  }

  const id = generateTakedownRequestId()
  insertTakedownRequest({ id, documentId: input.documentId, message })

  for (const file of files) {
    const fileName = safeFileName(file.name || "file")
    const bytes = new Uint8Array(await file.arrayBuffer())
    try {
      // Pinned like any other attachment, but deliberately never copied
      // into MFS: the vault's MFS tree is what gets published as the
      // site's root and snapshotted, so anything placed there is
      // effectively public regardless of whether the UI links to it.
      // Evidence attached to a takedown request stays out of that tree —
      // reachable only via its exact CID, which is what "not visible
      // publicly" means here. See attachmentsByDocumentId in
      // documents-db.server.ts for the read-side half of this.
      const { cid, size } = await addBytesToIpfs(bytes, fileName)
      insertAttachment({
        id: generateAttachmentId(),
        documentId: input.documentId,
        kind: "takedown_evidence",
        status: "complete",
        cid,
        fileName,
        mimeType: file.type || "application/octet-stream",
        fileSize: size,
        takedownRequestId: id,
      })
    } catch (err) {
      // Best-effort, same as screenshot/archive capture: the request
      // itself (the part that actually needs a human to see it) is
      // already recorded, so one evidence file failing to upload
      // shouldn't discard the whole submission.
      console.error(`failed to store takedown evidence file for request ${id}:`, err)
    }
  }

  return { id }
}
