import { createFileRoute, Link } from "@tanstack/react-router"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"
import { searchDocumentsByTag } from "../server/documents.functions"
import { formatCheckedAt } from "../utils/vault-status"

interface SearchParams {
  tag: string
}

export const Route = createFileRoute("/documents/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    tag: typeof search.tag === "string" ? search.tag : "",
  }),
  loaderDeps: ({ search }) => ({ tag: search.tag }),
  loader: ({ deps }) => (deps.tag.trim() ? searchDocumentsByTag({ data: { tag: deps.tag } }) : []),
  head: ({ match }) => ({
    meta: [
      { title: "Search — keepthereceipts.net" },
      { property: "og:url", content: `${match.context.baseUrl}${match.pathname}` },
    ],
    links: [{ rel: "canonical", href: `${match.context.baseUrl}${match.pathname}` }],
  }),
  component: SearchPage,
})

function SearchPage() {
  const documents = Route.useLoaderData()
  const { tag } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { currentUser } = Route.useRouteContext()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get("tag")?.toString() ?? ""
    navigate({ search: { tag: value } })
  }

  return (
    <PageShell currentUser={currentUser}>
      <div className={fadeClass} style={fadeIn(2)}>
        <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
          Search by tag
        </h1>
        <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55]">
          Find documents by the #hashtags they were tagged with.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`${fadeClass} flex items-end gap-2 mt-5`}
        style={fadeIn(3)}
      >
        <label className="flex-1 flex flex-col gap-1.5">
          <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">tag</span>
          <input
            type="search"
            name="tag"
            defaultValue={tag}
            key={tag}
            placeholder="e.g. utilities"
            className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
          />
        </label>
        <button
          type="submit"
          className="font-mono text-[0.82rem] tracking-[0.05em] uppercase border-2 border-ink px-4 py-2 hover:bg-ink hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2"
        >
          Search
        </button>
      </form>

      <div className={fadeClass} style={fadeIn(4)}>
        {!tag.trim() ? (
          <p className="mt-5 text-[0.94rem] text-ink-soft">Enter a tag above to search the vault.</p>
        ) : documents.length === 0 ? (
          <p className="mt-5 text-[0.94rem] text-ink-soft">No documents tagged &ldquo;{tag}&rdquo;.</p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3 list-none p-0 m-0">
            {documents.map((doc) => (
              <li key={doc.id} className="border border-ink px-4 py-3">
                <Link
                  to="/documents/$documentId"
                  params={{ documentId: doc.id }}
                  className="font-serif font-semibold text-[1.02rem] text-ink underline underline-offset-2 hover:text-stamp focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2"
                >
                  {doc.title}
                </Link>
                {doc.tags.length > 0 && (
                  <p className="font-mono text-[0.74rem] text-ink-soft mt-1 mb-0">
                    {doc.tags.map((t) => `#${t}`).join(" ")}
                  </p>
                )}
                <p className="font-mono text-[0.72rem] text-ink-soft mt-1 mb-0">{formatCheckedAt(doc.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <a
        href="/documents"
        className={`${fadeClass} inline-block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] mt-5 focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]`}
        style={fadeIn(5)}
      >
        &larr; Back to documents
      </a>
    </PageShell>
  )
}
