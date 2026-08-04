import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"
import { register } from "../server/auth.functions"

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [{ title: "Create an account — keepthereceipts.net" }],
  }),
  component: RegisterPage,
})

function RegisterPage() {
  const { currentUser } = Route.useRouteContext()
  const registerFn = useServerFn(register)

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await registerFn({ data: { username, email, password } })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setSuccess(result.username)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell currentUser={currentUser}>
      {success ? (
        <div className={`${fadeClass} border border-ink px-5 py-[18px]`} style={fadeIn(2)}>
          <p className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft m-0 mb-2.5">
            Account created
          </p>
          <p className="text-[0.94rem] text-ink m-0 mb-2">
            Welcome, <span className="font-mono">{success}</span>. Your account is ready.
          </p>
          <a
            className="inline-block font-mono text-[0.82rem] text-stamp underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-[3px]"
            href="/login"
          >
            &rarr; Log in
          </a>
        </div>
      ) : (
        <>
          <div className={fadeClass} style={fadeIn(2)}>
            <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
              Create an account
            </h1>
            <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55]">
              An account lets you add documents to the vault. Browsing and downloading never require one.
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
              <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">username</span>
              <input
                type="text"
                name="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">email</span>
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">password</span>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
              />
              <span className="font-mono text-[0.7rem] text-ink-soft">at least 8 characters</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 self-start font-mono text-[0.82rem] tracking-[0.05em] uppercase border-2 border-ink px-4 py-2 hover:bg-ink hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
        </>
      )}
    </PageShell>
  )
}
