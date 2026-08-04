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

function makeFakeBrowser() {
  const cdpSend = vi.fn(async () => ({ data: "<mhtml archive>" }))
  const page = {
    goto: vi.fn(async () => {}),
    screenshot: vi.fn(async () => Buffer.from("png-bytes")),
    context: () => ({ newCDPSession: async () => ({ send: cdpSend }) }),
  }
  return {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => {}),
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

    expect(mfsMkdirPMock).toHaveBeenCalledWith("/document/doc_1")
    expect(mfsCpMock).toHaveBeenCalledWith("bafyshot", "/document/doc_1/screenshot.png")
    expect(mfsCpMock).toHaveBeenCalledWith("bafyarchive", "/document/doc_1/archive.mhtml")
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
})
