import { SignJWT, jwtVerify } from "jose"
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server"

export const SESSION_COOKIE = "session"
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export interface SessionUser {
  id: string
  username: string
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not set")
  }
  return new TextEncoder().encode(secret)
}

export function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey())
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (typeof payload.sub !== "string" || typeof payload.username !== "string") {
      return null
    }
    return { id: payload.sub, username: payload.username }
  } catch {
    return null
  }
}

export function setSessionCookie(token: string): void {
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(): void {
  deleteCookie(SESSION_COOKIE, { path: "/" })
}

export async function readSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE)
  if (!token) return null
  return verifySessionToken(token)
}
