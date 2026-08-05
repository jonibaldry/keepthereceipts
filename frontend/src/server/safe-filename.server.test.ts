import { describe, expect, it } from "vitest"
import { safeFileName } from "./safe-filename.server"

describe("safeFileName", () => {
  it("passes through an ordinary filename unchanged", () => {
    expect(safeFileName("bill.pdf")).toBe("bill.pdf")
  })

  it("strips a forward-slash path-traversal prefix down to the basename", () => {
    expect(safeFileName("../../vault/vault.db")).toBe("vault.db")
  })

  it("strips a backslash path-traversal prefix down to the basename", () => {
    expect(safeFileName("..\\..\\windows\\evil.exe")).toBe("evil.exe")
  })

  it("strips control characters", () => {
    expect(safeFileName("bad\x00name.txt")).toBe("badname.txt")
  })

  it("falls back to a safe default when nothing usable is left", () => {
    expect(safeFileName("../..")).toBe("file")
    expect(safeFileName("")).toBe("file")
    expect(safeFileName(".")).toBe("file")
    expect(safeFileName("..")).toBe("file")
  })
})
