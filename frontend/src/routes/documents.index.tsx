import { createFileRoute } from "@tanstack/react-router"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"
import { listDocuments } from "../server/documents.functions"
import { formatCheckedAt } from "../utils/vault-status"

export const Route = createFileRoute("/documents/")({
  loader: () => listDocuments(),
  head: ({ match }) => ({
    meta: [
      { title: "Documents — keepthereceipts.net" },
      { property: "og:url", content: `${match.context.baseUrl}${match.pathname}` },
    ],
    links: [{ rel: "canonical", href: `${match.context.baseUrl}${match.pathname}` }],
  }),
  component: DocumentsPage,
})

function DocumentsPage() {
  const documents = Route.useLoaderData()
  const { currentUser } = Route.useRouteContext()

  return (
    <PageShell currentUser={currentUser}>
      <div className={fadeClass} style={fadeIn(2)}>
        <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
          Documents
        </h1>
        <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55]">
          Everything in the vault, newest first.
        </p>
      </div>

      <div className={`${fadeClass} flex gap-3 my-[18px]`} style={fadeIn(3)}>
        <a
          href="/documents/new"
          className="flex-1 block text-center font-mono text-[0.88rem] tracking-[0.05em] uppercase border-2 border-ink px-4 py-3 hover:bg-ink hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2"
        >
          + Add a document
        </a>
        <a
          href="/documents/search"
          className="flex-1 block text-center font-mono text-[0.88rem] tracking-[0.05em] uppercase border-2 border-ink px-4 py-3 hover:bg-ink hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2"
        >
          Search tags
        </a>
      </div>

      {documents.length === 0 ? (
        <p className={`${fadeClass} text-[0.94rem] text-ink-soft`} style={fadeIn(4)}>
          Nothing in the vault yet.
        </p>
      ) : (
        <ul className={`${fadeClass} flex flex-col gap-3 list-none p-0 m-0`} style={fadeIn(4)}>
          {documents.map((doc) => (
            <li key={doc.id} className="border border-ink px-4 py-3">
              <a
                href={`/documents/${doc.id}`}
                className="font-serif font-semibold text-[1.02rem] text-ink underline underline-offset-2 hover:text-stamp focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2"
              >
                {doc.title}
              </a>
              {doc.tags.length > 0 && (
                <p className="font-mono text-[0.74rem] text-ink-soft mt-1 mb-0">
                  {doc.tags.map((tag) => `#${tag}`).join(" ")}
                </p>
              )}
              <p className="font-mono text-[0.72rem] text-ink-soft mt-1 mb-0">
                {formatCheckedAt(doc.createdAt)}
                {doc.status === "pending" && " · pending…"}
                {doc.attachments.length > 0 &&
                  ` · ${doc.attachments.map((a) => a.kind).join(", ")}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
