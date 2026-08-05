import { createServerFn } from "@tanstack/react-start"
import { createTakedownRequest, TakedownRequestError } from "./takedown.server"
import { assertSameOrigin } from "./same-origin.server"
import { checkRateLimit, RateLimitError } from "./rate-limit.server"
import { clientIp } from "./client-ip.server"

export type RequestTakedownResult = { ok: true } | { ok: false; message: string }

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
