import { createFileRoute } from "@tanstack/react-router"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"
import { getVaultStatus, formatCheckedAt } from "../utils/vault-status"

const LEDGER_ITEMS = [
  { label: "CONTENT-ADDRESSED", value: "every file's address is a hash of its own bytes" },
  { label: "REPLICATED", value: "the vault lives wherever it's copied to, not one server" },
  { label: "SELF-HOSTABLE", value: "run the whole stack yourself with Docker Compose" },
  { label: "OPEN SOURCE", value: "read every line, or fork it and run your own" },
]

export const Route = createFileRoute("/")({
  loader: () => getVaultStatus(),
  head: () => ({
    meta: [
      { title: "keepthereceipts.net" },
      {
        name: "description",
        content:
          "A open source, shared, freely distributable document vault. Every file is stored with IPFS, so every document gets a cryptographic fingerprint. Copy or continuously replicate the vault to any machine — the fingerprint proves nothing changed.",
      },
    ],
  }),
  component: Home,
})

function Home() {
  const { cid, checkedAt, gatewayUrl, dnslinkDomain } = Route.useLoaderData()
  const { currentUser } = Route.useRouteContext()
  const checkedLabel = formatCheckedAt(checkedAt)

  return (
    <PageShell currentUser={currentUser}>
      <div className={fadeClass} style={fadeIn(2)}>
        <h1 className="font-serif font-bold text-[clamp(1.9rem,5vw,2.6rem)] leading-[1.12] tracking-[-0.01em] m-0 mb-3.5">
          A open source, shared, freely distributable document vault
        </h1>
        <p className="m-0 max-w-[46ch] text-ink-soft text-[1.02rem] leading-[1.55]">
          keepthereceipts.net stores your files with IPFS, so every document gets a cryptographic fingerprint. Copy
          or continuously replicate the vault to any machine &mdash; the fingerprint proves nothing changed.
        </p>
      </div>

      <hr className={`${fadeClass} border-0 border-t border-dashed border-paper-line my-[18px]`} style={fadeIn(3)} />

      <dl className={`${fadeClass} flex flex-col gap-3`} style={fadeIn(4)}>
        {LEDGER_ITEMS.map((item) => (
          <div
            key={item.label}
            className="flex items-baseline gap-2 flex-wrap max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-0.5"
          >
            <dt className="font-mono text-[0.72rem] tracking-[0.05em] font-medium whitespace-nowrap">
              {item.label}
            </dt>
            <span
              className="flex-1 min-w-4 border-b border-dotted border-paper-line mb-[0.3em] max-[480px]:hidden"
              aria-hidden="true"
            />
            <dd className="m-0 text-ink-soft text-[0.94rem] max-w-[32ch] max-[480px]:max-w-none">{item.value}</dd>
          </div>
        ))}
      </dl>

      <hr className={`${fadeClass} border-0 border-t border-dashed border-paper-line my-[18px]`} style={fadeIn(5)} />

      <a
        href="/documents/new"
        className={`${fadeClass} block text-center font-mono text-[0.88rem] tracking-[0.05em] uppercase border-2 border-ink px-4 py-3 mb-[18px] hover:bg-ink hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2`}
        style={fadeIn(6)}
      >
        + Add a document to the vault
      </a>

      <div className={`${fadeClass} border border-ink px-5 py-[18px] overflow-hidden`} style={fadeIn(7)}>
        <div className="flex justify-between items-start gap-3 mb-2.5">
          <p className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft m-0">Current vault root</p>
          {cid ? (
            <span
              className="shrink-0 -rotate-[6deg] font-mono font-medium text-[0.8rem] tracking-[0.1em] text-stamp border-2 border-stamp px-2 py-0.5 rounded-[3px] [mix-blend-mode:multiply] opacity-85"
              aria-hidden="true"
            >
              VERIFIED
            </span>
          ) : (
            <span
              className="shrink-0 -rotate-[6deg] font-mono font-medium text-[0.8rem] tracking-[0.1em] text-ink-soft border-2 border-ink-soft px-2 py-0.5 rounded-[3px] [mix-blend-mode:multiply] opacity-85"
              aria-hidden="true"
            >
              PENDING
            </span>
          )}
        </div>
        {cid ? (
          <>
            <p className="font-mono text-[0.88rem] break-all m-0 mb-2">{cid}</p>
            <p className="font-mono text-[0.74rem] text-ink-soft m-0 mb-1.5">checked {checkedLabel}</p>
            <a
              className="inline-block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]"
              href={`${gatewayUrl}/ipfs/${encodeURIComponent(cid)}/`}
            >
              Open on the gateway &rarr;
            </a>

            <div className="mt-3 pt-3 border-t border-dashed border-paper-line">
              <p className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft m-0 mb-1.5">
                Obtain and use the DNSLink
              </p>
              <p className="text-[0.86rem] text-ink-soft m-0 mb-2 max-w-[42ch]">
                Every time the vault changes, its hash is published as a DNS TXT record &mdash; so any IPFS node can
                find it without asking this page.
              </p>

              <p className="font-mono text-[0.7rem] text-ink-soft m-0 mb-0.5">obtain it</p>
              <code className="block font-mono text-[0.8rem] border-l-2 border-stamp pl-2 py-0.5 mb-2 break-all">
                dig +short TXT _dnslink.{dnslinkDomain}
              </code>

              <p className="font-mono text-[0.7rem] text-ink-soft m-0 mb-0.5">use it</p>
              <code className="block font-mono text-[0.8rem] border-l-2 border-stamp pl-2 py-0.5 break-all">
                ipfs get /ipns/{dnslinkDomain}
              </code>
            </div>
          </>
        ) : (
          <>
            <p className="text-[0.94rem] text-ink-soft max-w-[34ch] m-0 mb-2">
              No snapshot published yet. Once the vault&rsquo;s first document lands, its fingerprint prints here.
            </p>
            <p className="font-mono text-[0.74rem] text-ink-soft m-0">checked {checkedLabel}</p>
          </>
        )}
      </div>
    </PageShell>
  )
}
