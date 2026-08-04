import { afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ headers: new Map<string, string>() }))

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => state.headers.get(name.toLowerCase()),
}))

const { assertSameOrigin } = await import("./same-origin.server")

describe("assertSameOrigin", () => {
  afterEach(() => state.headers.clear())

  it("allows a same-origin sec-fetch-site request", () => {
    state.headers.set("sec-fetch-site", "same-origin")
    expect(() => assertSameOrigin()).not.toThrow()
  })

  it("allows sec-fetch-site: none (typed directly, not from a browser navigation)", () => {
    state.headers.set("sec-fetch-site", "none")
    expect(() => assertSameOrigin()).not.toThrow()
  })

  it("rejects a cross-site sec-fetch-site request", () => {
    state.headers.set("sec-fetch-site", "cross-site")
    expect(() => assertSameOrigin()).toThrow("Cross-site request rejected")
  })

  it("falls back to comparing Origin against Host when sec-fetch-site is absent", () => {
    state.headers.set("origin", "https://keepthereceipts.net")
    state.headers.set("host", "keepthereceipts.net")
    expect(() => assertSameOrigin()).not.toThrow()
  })

  it("rejects a mismatched Origin/Host", () => {
    state.headers.set("origin", "https://evil.example")
    state.headers.set("host", "keepthereceipts.net")
    expect(() => assertSameOrigin()).toThrow("Cross-site request rejected")
  })

  it("rejects an unparseable Origin", () => {
    state.headers.set("origin", "not-a-url")
    state.headers.set("host", "keepthereceipts.net")
    expect(() => assertSameOrigin()).toThrow("Cross-site request rejected")
  })

  it("allows the request through when neither header is present (non-browser client)", () => {
    expect(() => assertSameOrigin()).not.toThrow()
  })
})
