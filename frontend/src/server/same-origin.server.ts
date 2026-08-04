import { getRequestHeader } from "@tanstack/react-start/server"

// Rejects cross-site POSTs (login/register/logout CSRF). Sec-Fetch-Site is
// sent by all modern browsers and is authoritative when present; Origin is
// the fallback for older browsers. If neither header is present at all,
// the request is assumed to be from a non-browser client (curl, a future
// API consumer) rather than a forged cross-site browser request, so it's
// allowed through — CSRF is specifically a browser-auto-attached-cookie
// problem, not a concern for direct API callers.
export function assertSameOrigin(): void {
  const fetchSite = getRequestHeader("sec-fetch-site")
  if (fetchSite) {
    if (fetchSite === "same-origin" || fetchSite === "none") return
    throw new Error("Cross-site request rejected")
  }

  const origin = getRequestHeader("origin")
  if (origin) {
    const host = getRequestHeader("host")
    let originHost: string
    try {
      originHost = new URL(origin).host
    } catch {
      throw new Error("Cross-site request rejected")
    }
    if (originHost !== host) {
      throw new Error("Cross-site request rejected")
    }
  }
}
