import { addBytesToIpfs } from "./ipfs.server"
import { generateTakedownAttachmentId, generateTakedownRequestId } from "./id.server"
import { safeFileName } from "./safe-filename.server"
import { getDocument } from "./documents-db.server"
import { insertTakedownAttachment, insertTakedownRequest } from "./users-db.server"

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

  // getDocument reads from vault.db (public), just to confirm the document
  // exists — the request itself is recorded in users.db (private), see
  // below.
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
      // Pinned on IPFS for storage, like any other attachment, but its cid
      // is recorded only in users.db (private) — never in vault.db or MFS,
      // both of which get published as the site's root (see the warning
      // atop vault-db.server.ts). Reachable only by someone who already has
      // the exact cid, which is what "not visible publicly" means here.
      const { cid, size } = await addBytesToIpfs(bytes, fileName)
      insertTakedownAttachment({
        id: generateTakedownAttachmentId(),
        takedownRequestId: id,
        cid,
        fileName,
        mimeType: file.type || "application/octet-stream",
        fileSize: size,
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
