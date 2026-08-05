import { useState } from "react"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"
import { getDocument, deleteDocument } from "../server/documents.functions"
import { formatCheckedAt } from "../utils/vault-status"
import type { CaptureStatus, DocumentStatus } from "../server/documents-db.server"

export const Route = createFileRoute("/documents/$documentId")({
  loader: async ({ params }) => {
    const document = await getDocument({ data: { id: params.documentId } })
    if (!document) throw notFound()
    return document
  },
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: loaderData ? `${loaderData.title} — keepthereceipts.net` : "Document — keepthereceipts.net",
      },
      { property: "og:url", content: `${match.context.baseUrl}${match.pathname}` },
    ],
    links: [{ rel: "canonical", href: `${match.context.baseUrl}${match.pathname}` }],
  }),
  component: DocumentDetailPage,
})

function statusLabel(status: CaptureStatus): string {
  switch (status) {
    case "complete":
      return "ready"
    case "pending":
      return "capturing…"
    case "failed":
      return "capture failed"
  }
}

function documentStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case "active":
      return "active"
    case "pending":
      return "pending…"
  }
}

function DeleteDocumentControl({ documentId }: { documentId: string }) {
  const navigate = Route.useNavigate()
  const deleteDocumentFn = useServerFn(deleteDocument)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const result = await deleteDocumentFn({ data: { id: documentId } })
      if (!result.ok) {
        setError(result.message)
        return
      }
      navigate({ to: "/documents" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={`${fadeClass} mt-5 pt-4 border-t border-dashed border-paper-line`} style={fadeIn(8)}>
      <p className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft m-0 mb-2">Admin</p>
      {error && (
        <p role="alert" className="font-mono text-[0.82rem] text-stamp border-l-2 border-stamp pl-2 mb-2">
          {error}
        </p>
      )}
      {confirming ? (
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.82rem] text-ink">Delete this document permanently?</span>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="font-mono text-[0.78rem] tracking-[0.05em] uppercase border-2 border-stamp text-stamp px-3 py-1.5 hover:bg-stamp hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Confirm delete"}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirming(false)}
            className="font-mono text-[0.78rem] tracking-[0.05em] uppercase text-ink-soft underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="font-mono text-[0.78rem] tracking-[0.05em] uppercase border-2 border-ink px-3 py-1.5 hover:bg-ink hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2"
        >
          Delete document
        </button>
      )}
    </div>
  )
}

function DocumentDetailPage() {
  const document = Route.useLoaderData()
  const { currentUser, gatewayUrl } = Route.useRouteContext()

  const fileAttachment = document.attachments.find((a) => a.kind === "file")
  const screenshotAttachment = document.attachments.find((a) => a.kind === "screenshot")
  const archiveAttachment = document.attachments.find((a) => a.kind === "archive")
  const metadataAttachment = document.attachments.find((a) => a.kind === "metadata")

  return (
    <PageShell currentUser={currentUser}>
      <div className={fadeClass} style={fadeIn(2)}>
        <p className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft m-0 mb-2">
          {formatCheckedAt(document.createdAt)} &middot; {documentStatusLabel(document.status)}
        </p>
        <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
          {document.title}
        </h1>
        {document.description && (
          <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55] whitespace-pre-wrap">
            {document.description}
          </p>
        )}
        {document.tags.length > 0 && (
          <p className="font-mono text-[0.78rem] text-stamp mt-2 mb-0">
            {document.tags.map((tag) => `#${tag}`).join(" ")}
          </p>
        )}
      </div>

      <hr className={`${fadeClass} border-0 border-t border-dashed border-paper-line my-[18px]`} style={fadeIn(3)} />

      {fileAttachment && (
        <div className={`${fadeClass} border border-ink px-5 py-[18px]`} style={fadeIn(4)}>
          <h2 className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft m-0 mb-2.5">File</h2>
          <p className="text-[0.94rem] text-ink m-0 mb-1">{fileAttachment.fileName}</p>
          <p className="font-mono text-[0.74rem] text-ink-soft m-0 mb-2">
            {fileAttachment.mimeType} &middot; {((fileAttachment.fileSize ?? 0) / (1024 * 1024)).toFixed(2)} MB
          </p>
          <a
            className="inline-block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]"
            href={`${gatewayUrl}/ipfs/${encodeURIComponent(fileAttachment.cid ?? "")}?filename=${encodeURIComponent(fileAttachment.fileName)}`}
          >
            &rarr; Download from the gateway
          </a>
        </div>
      )}

      {document.sourceUrl && (
        <div className={`${fadeClass} border border-ink px-5 py-[18px] mt-4`} style={fadeIn(5)}>
          <h2 className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft m-0 mb-2.5">Source</h2>
          <a
            className="inline-block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] break-all focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]"
            href={document.sourceUrl}
          >
            {document.sourceUrl}
          </a>

          <div className="mt-3 pt-3 border-t border-dashed border-paper-line flex flex-col gap-2.5">
            {screenshotAttachment && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[0.74rem] text-ink-soft">
                    screenshot &middot; {statusLabel(screenshotAttachment.status)}
                  </span>
                  {screenshotAttachment.cid && (
                    <a
                      className="font-mono text-[0.78rem] text-stamp underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]"
                      href={`${gatewayUrl}/ipfs/${encodeURIComponent(screenshotAttachment.cid)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      open full size
                    </a>
                  )}
                </div>
                {screenshotAttachment.cid && (
                  <a
                    href={`${gatewayUrl}/ipfs/${encodeURIComponent(screenshotAttachment.cid)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block mt-2 max-h-[70vh] overflow-y-auto border border-paper-line focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2"
                  >
                    <img
                      src={`${gatewayUrl}/ipfs/${encodeURIComponent(screenshotAttachment.cid)}`}
                      alt={`Screenshot of ${document.sourceUrl}`}
                      className="w-full block"
                    />
                  </a>
                )}
              </div>
            )}
            {archiveAttachment && (
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[0.74rem] text-ink-soft">
                  offline archive &middot; {statusLabel(archiveAttachment.status)}
                </span>
                {archiveAttachment.cid && (
                  <a
                    className="font-mono text-[0.78rem] text-stamp underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]"
                    href={`${gatewayUrl}/ipfs/${encodeURIComponent(archiveAttachment.cid)}?filename=archive.mhtml`}
                  >
                    download
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {metadataAttachment?.cid && (
        <a
          className={`${fadeClass} block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] mt-5 focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]`}
          style={fadeIn(6)}
          href={`${gatewayUrl}/ipfs/${encodeURIComponent(metadataAttachment.cid)}?filename=${encodeURIComponent(metadataAttachment.fileName)}`}
        >
          &rarr; Download metadata (JSON)
        </a>
      )}

      <a
        href="/documents"
        className={`${fadeClass} inline-block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] ${metadataAttachment?.cid ? "mt-2" : "mt-5"} focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]`}
        style={fadeIn(metadataAttachment?.cid ? 7 : 6)}
      >
        &larr; Back to documents
      </a>

      {currentUser?.isAdmin && <DeleteDocumentControl documentId={document.id} />}
    </PageShell>
  )
}
