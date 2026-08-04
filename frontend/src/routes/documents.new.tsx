import { useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"
import { createDocument } from "../server/documents.functions"

export const Route = createFileRoute("/documents/new")({
  beforeLoad: ({ context }) => {
    if (!context.currentUser) {
      throw redirect({ to: "/login" })
    }
  },
  head: () => ({
    meta: [{ title: "Add a document — keepthereceipts.net" }],
  }),
  component: NewDocumentPage,
})

function NewDocumentPage() {
  const { currentUser } = Route.useRouteContext()
  const createDocumentFn = useServerFn(createDocument)

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await createDocumentFn({ data: formData })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setCreated({ id: result.document.id, title: result.document.title })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell currentUser={currentUser}>
      {created ? (
        <div className={`${fadeClass} border border-ink px-5 py-[18px]`} style={fadeIn(2)}>
          <p className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft m-0 mb-2.5">
            Document added
          </p>
          <p className="text-[0.94rem] text-ink m-0 mb-2">
            <span className="font-mono">{created.title}</span> is in the vault.
          </p>
          <div className="flex items-center gap-3">
            <a
              className="inline-block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]"
              href={`/documents/${created.id}`}
            >
              &rarr; View it
            </a>
            <a
              className="inline-block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]"
              href="/documents"
            >
              &rarr; Browse the vault
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className={fadeClass} style={fadeIn(2)}>
            <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
              Add a document
            </h1>
            <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55]">
              Attach a file, a source URL, or both. A file is copied straight into the vault; a source URL gets a
              screenshot and an offline archive captured in the background.
            </p>
          </div>

          {error && (
            <p
              className={`${fadeClass} font-mono text-[0.82rem] text-stamp border-l-2 border-stamp pl-2 mt-4`}
              style={fadeIn(3)}
            >
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className={`${fadeClass} mt-5 flex flex-col gap-4`} style={fadeIn(4)}>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">title</span>
              <input
                type="text"
                name="title"
                required
                className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">description</span>
              <textarea
                name="description"
                rows={3}
                className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
              />
              <span className="font-mono text-[0.7rem] text-ink-soft">use #hashtags to tag it</span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">
                source url (optional)
              </span>
              <input
                type="url"
                name="sourceUrl"
                placeholder="https://example.com/receipt"
                className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
              />
              <span className="font-mono text-[0.7rem] text-ink-soft">
                if set, we&rsquo;ll try to capture a screenshot and offline archive of the page
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">
                file (optional)
              </span>
              <input
                type="file"
                name="file"
                className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink file:mr-3 file:border file:border-ink file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[0.78rem] file:uppercase focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
              />
              <span className="font-mono text-[0.7rem] text-ink-soft">max 100MB</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 self-start font-mono text-[0.82rem] tracking-[0.05em] uppercase border-2 border-ink px-4 py-2 hover:bg-ink hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {submitting ? "Adding to vault…" : "Add to vault"}
            </button>
          </form>
        </>
      )}
    </PageShell>
  )
}
