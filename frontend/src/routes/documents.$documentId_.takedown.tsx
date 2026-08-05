import { useState } from "react"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"
import { getDocument } from "../server/documents.functions"
import { requestTakedown } from "../server/takedown.functions"

export const Route = createFileRoute("/documents/$documentId_/takedown")({
  loader: async ({ params }) => {
    const document = await getDocument({ data: { id: params.documentId } })
    if (!document) throw notFound()
    return document
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `Request takedown — ${loaderData.title} — keepthereceipts.net` : "Request takedown — keepthereceipts.net" }],
  }),
  component: TakedownPage,
})

function TakedownPage() {
  const document = Route.useLoaderData()
  const { currentUser } = Route.useRouteContext()
  const requestTakedownFn = useServerFn(requestTakedown)

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set("documentId", document.id)
      const result = await requestTakedownFn({ data: formData })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell currentUser={currentUser}>
      {submitted ? (
        <div className={`${fadeClass} border border-ink px-5 py-[18px]`} style={fadeIn(2)}>
          <p className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft m-0 mb-2.5">
            Request received
          </p>
          <p className="text-[0.94rem] text-ink m-0 mb-2">
            Thanks — we&rsquo;ve recorded your takedown request for <span className="font-mono">{document.title}</span>.
          </p>
          <a
            className="inline-block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]"
            href={`/documents/${document.id}`}
          >
            &larr; Back to the document
          </a>
        </div>
      ) : (
        <>
          <div className={fadeClass} style={fadeIn(2)}>
            <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
              Request takedown
            </h1>
            <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55]">
              Requesting removal of <span className="font-mono">{document.title}</span>. Tell us why, and
              optionally attach anything that supports the request &mdash; proof of identity, ownership, or the
              specific issue. Attachments are only used to review this request and are never published.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className={`${fadeClass} font-mono text-[0.82rem] text-stamp border-l-2 border-stamp pl-2 mt-4`}
              style={fadeIn(3)}
            >
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className={`${fadeClass} mt-5 flex flex-col gap-4`} style={fadeIn(4)}>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">message</span>
              <textarea
                name="message"
                rows={5}
                required
                className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">
                attachments (optional)
              </span>
              <input
                type="file"
                name="files"
                multiple
                className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink file:mr-3 file:border file:border-ink file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[0.78rem] file:uppercase focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
              />
              <span className="font-mono text-[0.7rem] text-ink-soft">up to 5 files, 100MB each</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 self-start font-mono text-[0.82rem] tracking-[0.05em] uppercase border-2 border-ink px-4 py-2 hover:bg-ink hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send request"}
            </button>
          </form>

          <a
            href={`/documents/${document.id}`}
            className={`${fadeClass} inline-block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] mt-5 focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]`}
            style={fadeIn(5)}
          >
            &larr; Back to the document
          </a>
        </>
      )}
    </PageShell>
  )
}
