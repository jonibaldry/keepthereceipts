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
    </main>
  )
}
