import { mfsRm, pinRm } from "./ipfs.server"
import { getDocument, markDocumentDeleted } from "./documents-db.server"

export class DeleteDocumentError extends Error {}

// The DB flag is the durable, authoritative record that the document is
// gone — set first so the document disappears from the app immediately even
// if the IPFS cleanup below only partially succeeds (e.g. the node is
// briefly unreachable). IPFS/MFS removal is best-effort on top of that: it
// unpublishes the document from the vault's MFS tree (so it drops out of the
// next snapshot) and unpins its attachments so the node can garbage-collect
// them, but "delete" is never fully guaranteed on content-addressed, freely
// replicable storage — copies made before deletion (other nodes, prior
// snapshots) aren't reachable from here.
export async function deleteDocument(documentId: string): Promise<void> {
  const document = getDocument(documentId)
  if (!document) {
    throw new DeleteDocumentError("document not found")
  }

  markDocumentDeleted(documentId)

  try {
    await mfsRm(`/document/${documentId}`)
  } catch (err) {
    console.error(`failed to remove MFS directory for document ${documentId}:`, err)
  }

  for (const attachment of document.attachments) {
    if (!attachment.cid) continue
    try {
      await pinRm(attachment.cid)
    } catch (err) {
      console.error(`failed to unpin ${attachment.cid} for document ${documentId}:`, err)
    }
  }
}
