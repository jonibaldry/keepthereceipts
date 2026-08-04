import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { addBytesToIpfs, mfsCp, mfsMkdirP } from "./ipfs.server"

describe("ipfs.server", () => {
  const originalFetch = global.fetch
  const originalApiUrl = process.env.IPFS_API_URL

  beforeEach(() => {
    process.env.IPFS_API_URL = "http://ipfs.test:5001"
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.IPFS_API_URL = originalApiUrl
  })

  it("adds bytes and parses the resulting CID and size", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input as string)
      expect(url.pathname).toBe("/api/v0/add")
      expect(url.searchParams.get("cid-version")).toBe("1")
      return new Response('{"Name":"receipt.pdf","Hash":"bafy123","Size":"42"}\n', { status: 200 })
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await addBytesToIpfs(new Uint8Array([1, 2, 3]), "receipt.pdf")
    expect(result).toEqual({ cid: "bafy123", size: 42 })
  })

  it("throws when add fails", async () => {
    global.fetch = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch
    await expect(addBytesToIpfs(new Uint8Array([1]), "x.txt")).rejects.toThrow("ipfs add failed")
  })

  it("mkdirs with parents=true", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input as string)
      expect(url.pathname).toBe("/api/v0/files/mkdir")
      expect(url.searchParams.get("arg")).toBe("/document/doc_1")
      expect(url.searchParams.get("parents")).toBe("true")
      return new Response("", { status: 200 })
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await mfsMkdirP("/document/doc_1")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("cp's an ipfs path to an MFS destination with both args", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input as string)
      expect(url.pathname).toBe("/api/v0/files/cp")
      expect(url.searchParams.getAll("arg")).toEqual(["/ipfs/bafy123", "/document/doc_1/file.pdf"])
      return new Response("", { status: 200 })
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await mfsCp("bafy123", "/document/doc_1/file.pdf")
  })

  it("throws when a files API call fails", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch
    await expect(mfsMkdirP("/document/doc_1")).rejects.toThrow("/api/v0/files/mkdir failed")
  })
})
