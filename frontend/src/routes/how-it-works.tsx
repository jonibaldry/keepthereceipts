import { createFileRoute } from "@tanstack/react-router"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"

export const Route = createFileRoute("/how-it-works")({
  head: ({ match }) => ({
    meta: [
      { title: "How it works — keepthereceipts.net" },
      { property: "og:url", content: `${match.context.baseUrl}${match.pathname}` },
    ],
    links: [{ rel: "canonical", href: `${match.context.baseUrl}${match.pathname}` }],
  }),
  component: HowItWorksPage,
})

function Section({ title, index, children }: { title: string; index: number; children: React.ReactNode }) {
  return (
    <div className={fadeClass} style={fadeIn(index)}>
      <h2 className="font-serif font-bold text-[1.05rem] leading-[1.3] m-0 mb-2">{title}</h2>
      <div className="flex flex-col gap-2.5 text-ink-soft text-[0.94rem] leading-[1.55] [&_a]:text-stamp [&_a]:underline [&_a]:underline-offset-2 [&_code]:font-mono [&_code]:text-[0.86rem]">
        {children}
      </div>
    </div>
  )
}

function HowItWorksPage() {
  const { currentUser } = Route.useRouteContext()

  return (
    <PageShell currentUser={currentUser}>
      <div className={fadeClass} style={fadeIn(2)}>
        <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
          How it works
        </h1>
        <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55]">
          Every document here is stored with IPFS, a content-addressed network. That&rsquo;s a fancy way of saying:
          an address is a hash of the bytes themselves, so anyone can verify a copy is unaltered without trusting
          us at all.
        </p>
      </div>

      <hr className={`${fadeClass} border-0 border-t border-dashed border-paper-line my-[18px]`} style={fadeIn(3)} />

      <div className="flex flex-col gap-5">
        <Section title="Content addressing, in short" index={4}>
          <p className="m-0">
            Most of the web is location-addressed: a URL tells your browser which server to ask, and you have to
            trust that server to give you back the right bytes. IPFS flips that around. Every piece of content gets
            a CID (content identifier) &mdash; a hash computed from its own data. Change one byte and the CID
            changes completely.
          </p>
          <p className="m-0">
            That means a CID is both an address and a receipt: if you fetch something by its CID and the hash
            checks out, you know for certain it&rsquo;s exactly the bytes that were originally published, no matter
            which server or node you got it from.
          </p>
        </Section>

        <Section title="A peer-to-peer network" index={5}>
          <p className="m-0">
            IPFS nodes don&rsquo;t go through a central server to talk to each other &mdash; they connect directly,
            peer to peer, and use a distributed hash table to find out who currently holds a given CID. Content is
            broken into blocks, and a node fetching a document asks its peers for whichever blocks it&rsquo;s
            missing, from whichever peers happen to have them.
          </p>
          <p className="m-0">
            Content addressing is what makes that efficient: a block&rsquo;s hash is its identity, so a node that
            already has a block never needs to re-fetch it, no matter where it came from. When the vault changes,
            that means only the actually-new blocks &mdash; a new document&rsquo;s files, an updated{" "}
            <code>metadata.json</code> &mdash; need to propagate. Everything unchanged is already sitting on every
            peer that had it before, and mirrors converge on the same state without anyone coordinating it.
          </p>
        </Section>

        <Section title="A folder per document" index={6}>
          <p className="m-0">
            Each document lives at <code>/vault/document/&lt;id&gt;/</code> in the vault&rsquo;s IPFS filesystem (MFS
            &mdash; IPFS&rsquo;s Mutable File System, a familiar directory tree built on top of content-addressed
            blocks). Inside, you&rsquo;ll find whatever was captured for that document: the uploaded file, a
            screenshot and offline archive if it came from a source URL, and always a <code>metadata.json</code>{" "}
            describing the document and linking every attachment by its own <code>ipfs://</code> address.
          </p>
        </Section>

        <Section title="The vault database" index={7}>
          <p className="m-0">
            Everything is indexed in a single SQLite database, <code>vault.db</code>. A background process takes a
            consistent snapshot of it roughly every minute, adds that snapshot to IPFS, and publishes it into the
            vault&rsquo;s MFS tree too &mdash; so the index itself is just as verifiable and copyable as the
            documents it describes.
          </p>
        </Section>

        <Section title="Finding the current version" index={8}>
          <p className="m-0">
            Content addresses change every time the vault changes, so there needs to be one stable place to look up
            &ldquo;what&rsquo;s current.&rdquo; We publish the vault&rsquo;s root hash as a DNS TXT record
            (DNSLink), which any IPFS node can resolve without ever asking this website directly. The homepage shows
            the current root and how to fetch it yourself.
          </p>
        </Section>

        <Section title="Anyone can run a copy" index={9}>
          <p className="m-0">
            The whole stack &mdash; IPFS node, database, and web frontend &mdash; is open source and packaged with
            Docker Compose, deliberately so it&rsquo;s easy to mirror. Because everything is content-addressed, a
            copy of the vault run by someone else is trivially verifiable against ours: same CIDs mean identical
            data, byte for byte.
          </p>
        </Section>

        <Section title="What this buys you" index={10}>
          <p className="m-0">
            A document you keep here isn&rsquo;t just uploaded &mdash; it&rsquo;s fingerprinted. Anyone holding a
            copy, on any node, can prove it&rsquo;s unaltered without needing to trust this site, this server, or
            us. That&rsquo;s the whole point of the name.
          </p>
        </Section>
      </div>
    </PageShell>
  )
}
