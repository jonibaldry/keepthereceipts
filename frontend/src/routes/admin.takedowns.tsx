import { useState } from "react"
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"
import { listTakedownRequestsForAdmin } from "../server/takedown.functions"
import { deleteDocument } from "../server/documents.functions"
import { formatCheckedAt } from "../utils/vault-status"
import type { AdminTakedownGroup } from "../server/takedown.functions"

export const Route = createFileRoute("/admin/takedowns")({
  // A 404 rather than a login redirect: logging back in wouldn't grant
  // admin, and there's no reason to confirm to a non-admin that this route
  // exists. listTakedownRequestsForAdmin re-checks admin status itself too
  // — see the comment there — since this is only a client/loader-level
  // guard.
  beforeLoad: ({ context }) => {
    if (!context.currentUser?.isAdmin) {
      throw notFound()
    }
  },
  loader: () => listTakedownRequestsForAdmin(),
  head: () => ({
    meta: [{ title: "Takedown requests — keepthereceipts.net" }],
  }),
  component: AdminTakedownsPage,
})

function ApproveTakedownControl({ documentId, title }: { documentId: string; title: string }) {
  const router = useRouter()
  const deleteDocumentFn = useServerFn(deleteDocument)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setDeleting(true)
    setError(null)
    try {
      const result = await deleteDocumentFn({ data: { id: documentId } })
      if (!result.ok) {
        setError(result.message)
        return
      }
      await router.invalidate()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-paper-line">
      {error && (
        <p role="alert" className="font-mono text-[0.82rem] text-stamp border-l-2 border-stamp pl-2 mb-2">
          {error}
        </p>
      )}
      {confirming ? (
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.82rem] text-ink">
            Delete <span className="font-sans">{title}</span> and close every request for it?
          </span>
          <button
            type="button"
            disabled={deleting}
            onClick={handleApprove}
            className="font-mono text-[0.78rem] tracking-[0.05em] uppercase border-2 border-stamp text-stamp px-3 py-1.5 hover:bg-stamp hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Confirm"}
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
          Approve &amp; delete document
        </button>
      )}
    </div>
  )
}

function TakedownGroup({ group, index }: { group: AdminTakedownGroup; index: number }) {
  const { gatewayUrl } = Route.useRouteContext()

  return (
    <div className={`${fadeClass} border border-ink px-5 py-[18px] mt-4`} style={fadeIn(3 + index)}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <a
          href={`/documents/${group.document.id}`}
          className="font-serif font-semibold text-[1.02rem] text-ink underline underline-offset-2 hover:text-stamp focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2"
        >
          {group.document.title}
        </a>
        <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">
          {group.document.status}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-3 list-none p-0 m-0">
        {group.requests.map((request) => (
          <li key={request.id} className="border border-paper-line px-3 py-2.5">
            <p className="font-mono text-[0.72rem] text-ink-soft m-0 mb-1.5">
              {formatCheckedAt(request.createdAt)}
            </p>
            <p className="text-[0.9rem] text-ink m-0 whitespace-pre-wrap">{request.message}</p>
            {request.attachments.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {request.attachments.map(
                  (attachment) =>
                    attachment.cid && (
                      <a
                        key={attachment.id}
                        href={`${gatewayUrl}/ipfs/${encodeURIComponent(attachment.cid)}?filename=${encodeURIComponent(attachment.fileName)}`}
                        className="inline-block font-mono text-[0.78rem] text-stamp underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]"
                      >
                        &rarr; {attachment.fileName}
                      </a>
                    ),
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <ApproveTakedownControl documentId={group.document.id} title={group.document.title} />
    </div>
  )
}

function AdminTakedownsPage() {
  const groups = Route.useLoaderData()
  const { currentUser } = Route.useRouteContext()

  return (
    <PageShell currentUser={currentUser}>
      <div className={fadeClass} style={fadeIn(2)}>
        <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
          Takedown requests
        </h1>
        <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55]">
          Evidence attachments are private — the links below go straight to the IPFS gateway rather than through
          the vault, and are never linked anywhere else.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className={`${fadeClass} mt-5 text-[0.94rem] text-ink-soft`} style={fadeIn(3)}>
          No open takedown requests.
        </p>
      ) : (
        groups.map((group, index) => <TakedownGroup key={group.document.id} group={group} index={index} />)
      )}
    </PageShell>
  )
}
