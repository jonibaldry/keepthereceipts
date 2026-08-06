import { createFileRoute } from "@tanstack/react-router"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"

export const Route = createFileRoute("/terms")({
  head: ({ match }) => ({
    meta: [
      { title: "Terms of use — keepthereceipts.net" },
      { property: "og:url", content: `${match.context.baseUrl}${match.pathname}` },
    ],
    links: [{ rel: "canonical", href: `${match.context.baseUrl}${match.pathname}` }],
  }),
  component: TermsPage,
})

function Section({ title, index, children }: { title: string; index: number; children: React.ReactNode }) {
  return (
    <div className={fadeClass} style={fadeIn(index)}>
      <h2 className="font-serif font-bold text-[1.05rem] leading-[1.3] m-0 mb-2">{title}</h2>
      <div className="flex flex-col gap-2.5 text-ink-soft text-[0.94rem] leading-[1.55] [&_a]:text-stamp [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </div>
  )
}

function TermsPage() {
  const { currentUser } = Route.useRouteContext()

  return (
    <PageShell currentUser={currentUser}>
      <div className={fadeClass} style={fadeIn(2)}>
        <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
          Terms of use
        </h1>
        <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55]">
          Short version: this is a public vault, not private storage. Upload documents you have the right to
          share, keep them lawful, and don&rsquo;t use it to distribute anything on the list below.
        </p>
      </div>

      <hr className={`${fadeClass} border-0 border-t border-dashed border-paper-line my-[18px]`} style={fadeIn(3)} />

      <div className="flex flex-col gap-5">
        <Section title="What this is" index={4}>
          <p className="m-0">
            keepthereceipts.net is a self-hosted, open source, content-addressed document vault. Anything uploaded
            is stored on IPFS, indexed in a public database, and can be fetched by anyone who has or discovers its
            address &mdash; see <a href="/how-it-works">how it works</a> and our{" "}
            <a href="/privacy">privacy page</a> for the details. It is not a private file host, and there is no
            expectation of confidentiality for anything you upload.
          </p>
        </Section>

        <Section title="Acceptable use" index={5}>
          <p className="m-0">By using this site to add a document, you agree not to upload or link to anything that:</p>
          <ul className="m-0 pl-5 list-disc flex flex-col gap-1.5">
            <li>is illegal to possess or distribute where you or we operate;</li>
            <li>
              depicts child sexual abuse material, or any sexual content involving minors &mdash; this is never
              tolerated, reported, and grounds for an immediate, permanent block;
            </li>
            <li>is pornographic or sexually explicit content of any kind;</li>
            <li>
              is non-consensual intimate imagery, or otherwise violates someone else&rsquo;s reasonable expectation
              of privacy;
            </li>
            <li>infringes someone else&rsquo;s copyright, trademark, or other intellectual property rights;</li>
            <li>
              doxxes, harasses, or unlawfully discloses another person&rsquo;s private or personal data without
              their consent;
            </li>
            <li>contains malware, or is designed to facilitate fraud, phishing, or a scam;</li>
            <li>is defamatory, or otherwise unlawful to publish.</li>
          </ul>
        </Section>

        <Section title="Your responsibility" index={6}>
          <p className="m-0">
            You&rsquo;re solely responsible for what you upload and for making sure doing so is lawful for you,
            including any rules in your jurisdiction about sharing other people&rsquo;s personal data or
            copyrighted material. We don&rsquo;t review documents before they&rsquo;re published.
          </p>
        </Section>

        <Section title="Removal and enforcement" index={7}>
          <p className="m-0">
            Anyone &mdash; no account required &mdash; can ask for a document to be taken down from that
            document&rsquo;s page. We review every request and can remove documents that violate these terms.
            Because the vault is designed to be freely copied and replicated, removal here can&rsquo;t reach copies
            already made by others; see the privacy page for more on what &ldquo;removal&rdquo; actually means on
            content-addressed storage.
          </p>
        </Section>

        <Section title="No warranty" index={8}>
          <p className="m-0">
            This service is provided as-is, with no guarantee of uptime, availability, or permanence. It&rsquo;s
            run on a best-effort basis. Don&rsquo;t rely on it as your only copy of anything important.
          </p>
        </Section>

        <Section title="Running your own copy" index={9}>
          <p className="m-0">
            The software behind this site is open source and self-hostable. These terms apply to the instance at{" "}
            <span className="font-mono">keepthereceipts.net</span>; anyone running their own copy of the software
            sets and is responsible for their own terms.
          </p>
        </Section>

        <Section title="Questions" index={10}>
          <p className="m-0">
            Raise a question or report a problem on{" "}
            <a href="https://github.com/jonibaldry/keepthereceipts">GitHub</a>.
          </p>
        </Section>
      </div>
    </PageShell>
  )
}
