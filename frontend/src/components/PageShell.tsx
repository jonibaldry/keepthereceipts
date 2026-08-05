import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { fadeClass, fadeIn } from "../utils/animation"
import { logout } from "../server/auth.functions"
import type { SessionUser } from "../server/session.server"

interface PageShellProps {
  currentUser: SessionUser | null
  children: React.ReactNode
}

const navLinkClass =
  "underline underline-offset-2 hover:text-stamp focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2"

function AuthNav({ currentUser }: { currentUser: SessionUser | null }) {
  const router = useRouter()
  const logoutFn = useServerFn(logout)

  if (currentUser) {
    return (
      <div className="flex items-baseline gap-3">
        <a href="/documents" className={navLinkClass}>
          documents
        </a>
        <a href="/documents/search" className={navLinkClass}>
          search
        </a>
        <form
          className="inline"
          onSubmit={async (e) => {
            e.preventDefault()
            await logoutFn()
            await router.invalidate()
            router.navigate({ to: "/" })
          }}
        >
          <button
            type="submit"
            className={`${navLinkClass} appearance-none bg-transparent border-0 p-0 cursor-pointer`}
          >
            log out ({currentUser.username})
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex items-baseline gap-3">
      <a href="/documents" className={navLinkClass}>
        documents
      </a>
      <a href="/documents/search" className={navLinkClass}>
        search
      </a>
      <a href="/register" className={navLinkClass}>
        create account
      </a>
      <a href="/login" className={navLinkClass}>
        log in
      </a>
    </div>
  )
}

export function PageShell({ currentUser, children }: PageShellProps) {
  return (
    <main className="receipt relative w-full max-w-[620px] bg-paper px-5 sm:px-[clamp(20px,5vw,48px)] pt-10 pb-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)]">
      <div
        className={`${fadeClass} flex justify-between items-baseline gap-3 font-mono text-[0.72rem] tracking-[0.06em] text-ink-soft uppercase`}
        style={fadeIn(0)}
      >
        <span>keepthereceipts.net</span>
        <AuthNav currentUser={currentUser} />
      </div>

      <hr className={`${fadeClass} border-0 border-t border-dashed border-paper-line my-[18px]`} style={fadeIn(1)} />

      {children}

      <hr
        className={`${fadeClass} border-0 border-t border-dashed border-paper-line my-[18px]`}
        style={{ animationDelay: "0.5s" }}
      />

      <p
        className={`${fadeClass} font-mono text-[0.72rem] text-ink-soft text-center m-0`}
        style={{ animationDelay: "0.55s" }}
      >
        self-hosted &middot; open source &middot; no account required
      </p>

      <a
        href="https://github.com/jonibaldry/keepthereceipts"
        aria-label="View source on GitHub"
        className={`${fadeClass} flex justify-center mt-2 text-ink-soft hover:text-stamp focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2`}
        style={{ animationDelay: "0.6s" }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 0c-4.42 0-8 3.58-8 8a8.01 8.01 0 0 0 5.47 7.59c.4.08.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
      </a>
    </main>
  )
}
