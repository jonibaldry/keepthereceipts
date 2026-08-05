import { createFileRoute } from "@tanstack/react-router"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"

export const Route = createFileRoute("/privacy")({
  head: ({ match }) => ({
    meta: [
      { title: "Privacy — keepthereceipts.net" },
      { property: "og:url", content: `${match.context.baseUrl}${match.pathname}` },
    ],
    links: [{ rel: "canonical", href: `${match.context.baseUrl}${match.pathname}` }],
  }),
  component: PrivacyPage,
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

function PrivacyPage() {
  const { currentUser } = Route.useRouteContext()

  return (
    <PageShell currentUser={currentUser}>
      <div className={fadeClass} style={fadeIn(2)}>
        <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
          Privacy
        </h1>
        <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55]">
          Short version: one cookie keeps you logged in, we don&rsquo;t track you, and we don&rsquo;t sell or share
          your data. Everything you upload is public &mdash; see below.
        </p>
      </div>

      <hr className={`${fadeClass} border-0 border-t border-dashed border-paper-line my-[18px]`} style={fadeIn(3)} />

      <div className="flex flex-col gap-5">
        <Section title="Cookies" index={4}>
          <p className="m-0">
            We set exactly one cookie, <code className="font-mono text-[0.86rem]">session</code>, when you log in.
            It&rsquo;s httpOnly, sent only over HTTPS in production, and expires after 7 days. Its only job is
            keeping you signed in &mdash; there are no analytics, advertising, or third-party tracking cookies.
          </p>
        </Section>

        <Section title="What we store" index={5}>
          <p className="m-0">
            Creating an account stores your username, email address, and a bcrypt hash of your password &mdash;
            never the password itself. Your email is never shown to other users. We don&rsquo;t use it to send
            marketing, and we don&rsquo;t share it with anyone.
          </p>
        </Section>

        <Section title="Third parties" index={6}>
          <p className="m-0">
            We don&rsquo;t run analytics and we don&rsquo;t share your account data with third parties. Page
            typefaces are loaded from Google Fonts, which means your browser makes a direct request to Google&rsquo;s
            font CDN when you load a page.
          </p>
        </Section>

        <Section title="Uploaded documents are public" index={7}>
          <p className="m-0">
            This is a public, content-addressed vault &mdash; not private storage. Anything you upload is stored on
            IPFS, pinned, and indexed in the open vault database. It can be fetched by anyone who has or discovers
            its address, and may end up replicated on other nodes outside our control, including ones we can&rsquo;t
            reach to remove content from.
          </p>
          <p className="m-0">
            Only upload documents you&rsquo;re genuinely fine having public, and make sure doing so is lawful for
            you &mdash; including any rules in your jurisdiction about sharing other people&rsquo;s personal data or
            copyrighted material. That responsibility is yours.
          </p>
        </Section>

        <Section title="Removing something" index={8}>
          <p className="m-0">
            We can stop hosting our own copy of a document on request, but because the vault is designed to be
            freely copied and replicated, we can&rsquo;t guarantee removal from copies we don&rsquo;t control.
            Treat anything uploaded here as permanent and public.
          </p>
        </Section>

        <Section title="Questions" index={9}>
          <p className="m-0">
            This project is open source &mdash; you can read exactly how it works, or raise a question, on{" "}
            <a href="https://github.com/jonibaldry/keepthereceipts">GitHub</a>.
          </p>
        </Section>
      </div>
    </PageShell>
  )
}
