import { describe, expect, it } from "vitest"
import { formatCheckedAt } from "./vault-status"

describe("formatCheckedAt", () => {
  it("swaps the ISO T separator for a space and Z for UTC", () => {
    expect(formatCheckedAt("2026-08-04T08:37:27.123Z")).toBe("2026-08-04 08:37:27 UTC")
  })

  it("handles a timestamp with no fractional seconds", () => {
    expect(formatCheckedAt("2026-08-04T08:37:27Z")).toBe("2026-08-04 08:37:27 UTC")
  })
})
