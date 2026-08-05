import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { PageShell } from "../components/PageShell"
import { fadeClass, fadeIn } from "../utils/animation"
import { login } from "../server/auth.functions"

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Log in — keepthereceipts.net" }],
  }),
  component: LoginPage,
})

function LoginPage() {
  const { currentUser } = Route.useRouteContext()
  const router = useRouter()
  const loginFn = useServerFn(login)

  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await loginFn({ data: { identifier, password } })
      if (!result.ok) {
        setError(result.message)
        return
      }
      await router.invalidate()
      router.navigate({ to: "/" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell currentUser={currentUser}>
      <div className={fadeClass} style={fadeIn(2)}>
        <h1 className="font-serif font-bold text-[clamp(1.7rem,4.5vw,2.2rem)] leading-[1.15] tracking-[-0.01em] m-0 mb-3">
          Log in
        </h1>
        <p className="m-0 max-w-[46ch] text-ink-soft text-[1rem] leading-[1.55]">
          Use the username or email you registered with.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className={`${fadeClass} font-mono text-[0.82rem] text-stamp border-l-2 border-stamp pl-2 mt-4`}
          style={fadeIn(3)}
        >
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className={`${fadeClass} mt-5 flex flex-col gap-4`} style={fadeIn(4)}>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">
            username or email
          </span>
          <input
            type="text"
            name="identifier"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.72rem] tracking-[0.08em] uppercase text-ink-soft">password</span>
          <input
            type="password"
            name="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="border border-paper-line bg-paper px-3 py-2 text-[0.94rem] text-ink focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-1"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 self-start font-mono text-[0.82rem] tracking-[0.05em] uppercase border-2 border-ink px-4 py-2 hover:bg-ink hover:text-paper transition-colors focus-visible:outline-2 focus-visible:outline-stamp focus-visible:outline-offset-2 disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </PageShell>
  )
}
