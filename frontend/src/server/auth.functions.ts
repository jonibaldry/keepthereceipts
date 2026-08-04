import { createServerFn } from "@tanstack/react-start"
import { loginUser, LoginError } from "./login-user.server"
import { registerUser, RegistrationError } from "./register-user.server"
import { createSessionToken, setSessionCookie, clearSessionCookie, readSessionUser } from "./session.server"
import { assertSameOrigin } from "./same-origin.server"
import type { SessionUser } from "./session.server"

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
  async (): Promise<SessionUser | null> => readSessionUser(),
)

export const login = createServerFn({ method: "POST" })
  .validator((data: LoginInput) => data)
  .handler(async ({ data }): Promise<LoginResult> => {
    assertSameOrigin()
    try {
      const user = await loginUser(data)
      const token = await createSessionToken(user)
      setSessionCookie(token)
      return { ok: true, user }
    } catch (err) {
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
      const user = await registerUser(data)
      return { ok: true, username: user.username }
    } catch (err) {
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
