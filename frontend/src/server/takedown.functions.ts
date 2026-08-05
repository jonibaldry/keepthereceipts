import { createServerFn } from "@tanstack/react-start"
import { createTakedownRequest, TakedownRequestError } from "./takedown.server"
import { assertSameOrigin } from "./same-origin.server"
import { checkRateLimit, RateLimitError } from "./rate-limit.server"
import { clientIp } from "./client-ip.server"
import { readSessionUser } from "./session.server"
import { isUserAdmin, listTakedownRequests } from "./users-db.server"
import { getDocument } from "./documents-db.server"
import type { TakedownRequestRecord } from "./users-db.server"
import type { DocumentStatus } from "./documents-db.server"

export type RequestTakedownResult = { ok: true } | { ok: false; message: string }

export interface AdminTakedownGroup {
  document: { id: string; title: string; status: DocumentStatus }
  requests: TakedownRequestRecord[]
}

// Deliberately no login required — the point is that someone with no
// account (whose document this is, or whose data appears in it) can ask
// for it to come down. That makes it an unauthenticated endpoint that also
// accepts file uploads, so it's rate limited per IP the same way
// registration is.
const TAKEDOWN_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 }

interface TakedownFormInput {
  documentId: string
  message: string
  files: File[]
}

export const requestTakedown = createServerFn({ method: "POST" })
  .validator((data: unknown): TakedownFormInput => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected FormData")
    }
    const files = data.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0)
    return {
      documentId: data.get("documentId")?.toString() ?? "",
      message: data.get("message")?.toString() ?? "",
      files,
    }
  })
  .handler(async ({ data }): Promise<RequestTakedownResult> => {
    assertSameOrigin()
    try {
      checkRateLimit(`takedown:${clientIp()}`, TAKEDOWN_RATE_LIMIT)
      await createTakedownRequest(data)
      return { ok: true }
    } catch (err) {
      if (err instanceof RateLimitError) {
        return { ok: false, message: `too many requests — try again in ${err.retryAfterSeconds}s` }
      }
      if (err instanceof TakedownRequestError) {
        return { ok: false, message: err.message }
      }
      throw err
    }
  })

// The /admin/takedowns route already gates access via beforeLoad (redirects
// non-admins away before this ever runs in the normal UI flow), but that's
// a client/loader-level guard — this server function is its own callable
// endpoint, so it re-checks admin status itself rather than trusting the
// route. Returns an empty list rather than throwing for a non-admin caller,
// since there's nothing sensitive in "no results".
export const listTakedownRequestsForAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminTakedownGroup[]> => {
    const user = await readSessionUser()
    if (!user || !isUserAdmin(user.id)) {
      return []
    }

    const groups = new Map<string, AdminTakedownGroup>()
    for (const request of listTakedownRequests()) {
      let group = groups.get(request.documentId)
      if (!group) {
        const document = getDocument(request.documentId)
        // Shouldn't happen going forward — deleting a document also clears
        // its takedown requests (see delete-document.server.ts) — but skip
        // defensively rather than crash the whole list over one stale row.
        if (!document) continue
        group = { document: { id: document.id, title: document.title, status: document.status }, requests: [] }
        groups.set(request.documentId, group)
      }
      group.requests.push(request)
    }
    return Array.from(groups.values())
  },
)
