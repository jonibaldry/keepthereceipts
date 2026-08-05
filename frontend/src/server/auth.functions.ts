import { createServerFn } from "@tanstack/react-start"
import { getRequestIP } from "@tanstack/react-start/server"
import { loginUser, LoginError } from "./login-user.server"
import { registerUser, RegistrationError } from "./register-user.server"
import { createSessionToken, setSessionCookie, clearSessionCookie, readSessionUser } from "./session.server"
import { assertSameOrigin } from "./same-origin.server"
import { checkRateLimit, RateLimitError } from "./rate-limit.server"
import { isUserAdmin } from "./users-db.server"
import type { SessionUser } from "./session.server"

export interface CurrentUser extends SessionUser {
  isAdmin: boolean
}

// Caddy is the only thing that ever talks to this app directly (see
// docker-compose.yml/Caddyfile), and it sets X-Forwarded-For on every
// proxied request, so it's safe to trust here.
function clientIp(): string {
  return getRequestIP({ xForwardedFor: true }) ?? "unknown"
}

// Generous enough that a user fumbling their password a few times never
// notices, tight enough to make scripted brute-forcing impractical.
const LOGIN_RATE_LIMIT = { max: 10, windowMs: 5 * 60 * 1000 }
// Registration is free and instant, so mass account creation needs its own
// (tighter, longer-window) limit independent of login attempts.
const REGISTER_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 }

interface LoginInput {
  identifier: string
  password: string
}

interface RegisterInput {
  username: string
  email: string
  password: string
}

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; message: string }

export type RegisterResult =
  | { ok: true; username: string }
  | { ok: false; code: "invalid" | "conflict" | "unknown"; message: string }

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const user = await readSessionUser()
    if (!user) return null
    // Checked fresh against the db rather than embedded in the session
    // token, so admin access (granted or revoked directly in the db —
    // there's no admin UI yet) takes effect on the next request instead of
    // waiting for the user's existing 7-day token to expire.
    return { ...user, isAdmin: isUserAdmin(user.id) }
  },
)

export const login = createServerFn({ method: "POST" })
  .validator((data: LoginInput) => data)
  .handler(async ({ data }): Promise<LoginResult> => {
    assertSameOrigin()
    try {
      checkRateLimit(`login:${clientIp()}`, LOGIN_RATE_LIMIT)
      const user = await loginUser(data)
      const token = await createSessionToken(user)
      setSessionCookie(token)
      return { ok: true, user }
    } catch (err) {
      if (err instanceof RateLimitError) {
        return { ok: false, message: `too many attempts — try again in ${err.retryAfterSeconds}s` }
      }
      if (err instanceof LoginError) {
        return { ok: false, message: err.message }
      }
      throw err
    }
  })

export const register = createServerFn({ method: "POST" })
  .validator((data: RegisterInput) => data)
  .handler(async ({ data }): Promise<RegisterResult> => {
    assertSameOrigin()
    try {
      checkRateLimit(`register:${clientIp()}`, REGISTER_RATE_LIMIT)
      const user = await registerUser(data)
      return { ok: true, username: user.username }
    } catch (err) {
      if (err instanceof RateLimitError) {
        return { ok: false, code: "unknown", message: `too many attempts — try again in ${err.retryAfterSeconds}s` }
      }
      if (err instanceof RegistrationError) {
        return { ok: false, code: err.code, message: err.message }
      }
      throw err
    }
  })

export const logout = createServerFn({ method: "POST" }).handler(async (): Promise<{ ok: true }> => {
  assertSameOrigin()
  clearSessionCookie()
  return { ok: true }
})
