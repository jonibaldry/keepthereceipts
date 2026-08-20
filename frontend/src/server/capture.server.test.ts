import { beforeEach, describe, expect, it, vi } from "vitest"

const { launchMock, addBytesMock, mfsCpMock, mfsMkdirPMock, updateAttachmentMock } = vi.hoisted(() => ({
  launchMock: vi.fn(),
  addBytesMock: vi.fn(),
  mfsCpMock: vi.fn(),
  mfsMkdirPMock: vi.fn(),
  updateAttachmentMock: vi.fn(),
}))

vi.mock("playwright-core", () => ({
  chromium: { launch: launchMock },
}))

vi.mock("./ipfs.server", () => ({
  addBytesToIpfs: addBytesMock,
  mfsCp: mfsCpMock,
  mfsMkdirP: mfsMkdirPMock,
}))

vi.mock("./documents-db.server", () => ({
  updateAttachment: updateAttachmentMock,
}))

import { captureAndStore } from "./capture.server"

function makeFakePage() {
  const cdpSend = vi.fn(async () => ({ data: "<mhtml archive>" }))
  return {
    route: vi.fn(async (_pattern: string, _handler: (route: ReturnType<typeof fakeRoute>) => Promise<void>) => {}),
    goto: vi.fn(async () => {}),
    screenshot: vi.fn(async () => Buffer.from("png-bytes")),
    context: () => ({ newCDPSession: async () => ({ send: cdpSend }) }),
  }
}

function makeFakeBrowser(page = makeFakePage()) {
  return {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => {}),
  }
}

function fakeRoute(url: string) {
  return {
    request: () => ({ url: () => url }),
    continue: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  }
}

describe("captureAndStore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mfsMkdirPMock.mockResolvedValue(undefined)
    mfsCpMock.mockResolvedValue(undefined)
  })

  it("captures a screenshot and archive, stores them in IPFS/MFS, and records both attachments", async () => {
    launchMock.mockResolvedValue(makeFakeBrowser())
    addBytesMock
      .mockResolvedValueOnce({ cid: "bafyshot", size: 9 })
      .mockResolvedValueOnce({ cid: "bafyarchive", size: 20 })

    await captureAndStore("doc_1", "https://example.com/receipt", "att_shot", "att_arch")

    expect(mfsMkdirPMock).toHaveBeenCalledWith("/vault/document/doc_1")
    expect(mfsCpMock).toHaveBeenCalledWith("bafyshot", "/vault/document/doc_1/screenshot.png")
    expect(mfsCpMock).toHaveBeenCalledWith("bafyarchive", "/vault/document/doc_1/archive.mhtml")
    expect(updateAttachmentMock).toHaveBeenCalledWith("att_shot", { cid: "bafyshot", fileSize: 9, status: "complete" })
    expect(updateAttachmentMock).toHaveBeenCalledWith("att_arch", {
      cid: "bafyarchive",
      fileSize: 20,
      status: "complete",
    })
  })

  it("marks both attachments failed when the browser/page capture itself fails", async () => {
    launchMock.mockRejectedValue(new Error("no chromium binary"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await captureAndStore("doc_1", "https://example.com/receipt", "att_shot", "att_arch")

    expect(updateAttachmentMock).toHaveBeenCalledWith("att_shot", { status: "failed" })
    expect(updateAttachmentMock).toHaveBeenCalledWith("att_arch", { status: "failed" })
    expect(mfsMkdirPMock).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it("marks only the screenshot failed when its IPFS upload fails but the archive succeeds", async () => {
    launchMock.mockResolvedValue(makeFakeBrowser())
    addBytesMock.mockRejectedValueOnce(new Error("ipfs down")).mockResolvedValueOnce({ cid: "bafyarchive", size: 20 })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await captureAndStore("doc_1", "https://example.com/receipt", "att_shot", "att_arch")

    expect(updateAttachmentMock).toHaveBeenCalledWith("att_shot", { status: "failed" })
    expect(updateAttachmentMock).toHaveBeenCalledWith("att_arch", {
      cid: "bafyarchive",
      fileSize: 20,
      status: "complete",
    })
    errorSpy.mockRestore()
  })

  it("registers a request-blocking route before navigating, so it's in place for every request the page makes", async () => {
    const page = makeFakePage()
    launchMock.mockResolvedValue(makeFakeBrowser(page))
    addBytesMock
      .mockResolvedValueOnce({ cid: "bafyshot", size: 9 })
      .mockResolvedValueOnce({ cid: "bafyarchive", size: 20 })

    await captureAndStore("doc_1", "https://example.com/receipt", "att_shot", "att_arch")

    expect(page.route).toHaveBeenCalledWith("**/*", expect.any(Function))
    const routeCallOrder = page.route.mock.invocationCallOrder[0]
    const gotoCallOrder = page.goto.mock.invocationCallOrder[0]
    expect(routeCallOrder).toBeLessThan(gotoCallOrder)
  })

  describe("the registered request-blocking route", () => {
    async function getRouteHandler() {
      const page = makeFakePage()
      launchMock.mockResolvedValue(makeFakeBrowser(page))
      addBytesMock
        .mockResolvedValueOnce({ cid: "bafyshot", size: 9 })
        .mockResolvedValueOnce({ cid: "bafyarchive", size: 20 })
      await captureAndStore("doc_1", "https://example.com/receipt", "att_shot", "att_arch")
      return page.route.mock.calls[0][1]
    }

    it("allows a request to a public address", async () => {
      const handler = await getRouteHandler()
      const route = fakeRoute("https://example.com/logo.png")

      await handler(route)

      expect(route.continue).toHaveBeenCalled()
      expect(route.abort).not.toHaveBeenCalled()
    })

    it("blocks a request to a private IPv4 address", async () => {
      const handler = await getRouteHandler()
      const route = fakeRoute("http://10.0.0.5/secret")

      await handler(route)

      expect(route.abort).toHaveBeenCalledWith("blockedbyclient")
      expect(route.continue).not.toHaveBeenCalled()
    })

    it("blocks a request to a cloud metadata address embedded in the page", async () => {
      const handler = await getRouteHandler()
      const route = fakeRoute("http://169.254.169.254/latest/meta-data/")

      await handler(route)

      expect(route.abort).toHaveBeenCalledWith("blockedbyclient")
    })

    it("blocks a request to localhost regardless of port", async () => {
      const handler = await getRouteHandler()
      const route = fakeRoute("http://127.0.0.1:5001/api/v0/id")

      await handler(route)

      expect(route.abort).toHaveBeenCalledWith("blockedbyclient")
    })

    it("allows a non-http(s) request (e.g. data:) through unchecked", async () => {
      const handler = await getRouteHandler()
      const route = fakeRoute("data:image/png;base64,aGVsbG8=")

      await handler(route)

      expect(route.continue).toHaveBeenCalled()
      expect(route.abort).not.toHaveBeenCalled()
    })
  })
})
