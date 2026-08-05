import { beforeEach, describe, expect, it, vi } from "vitest"

const { addBytesMock, getDocumentMock, insertTakedownRequestMock, insertAttachmentMock } = vi.hoisted(() => ({
  addBytesMock: vi.fn(),
  getDocumentMock: vi.fn(),
  insertTakedownRequestMock: vi.fn(),
  insertAttachmentMock: vi.fn(),
}))

vi.mock("./ipfs.server", () => ({
  addBytesToIpfs: addBytesMock,
}))

vi.mock("./documents-db.server", () => ({
  getDocument: getDocumentMock,
  insertTakedownRequest: insertTakedownRequestMock,
  insertAttachment: insertAttachmentMock,
}))

import {
  createTakedownRequest,
  TakedownRequestError,
  MAX_TAKEDOWN_FILES,
  MAX_TAKEDOWN_MESSAGE_LENGTH,
} from "./takedown.server"

function makeFile(name: string, content: string, type = "text/plain"): File {
  return new File([content], name, { type })
}

describe("createTakedownRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDocumentMock.mockReturnValue({ id: "doc_1" })
    addBytesMock.mockResolvedValue({ cid: "bafyevidence", size: 5 })
  })

  it("rejects an empty message", async () => {
    await expect(
      createTakedownRequest({ documentId: "doc_1", message: "   ", files: [] }),
    ).rejects.toThrow(TakedownRequestError)
    expect(insertTakedownRequestMock).not.toHaveBeenCalled()
  })

  it("rejects an overly long message", async () => {
    await expect(
      createTakedownRequest({
        documentId: "doc_1",
        message: "x".repeat(MAX_TAKEDOWN_MESSAGE_LENGTH + 1),
        files: [],
      }),
    ).rejects.toThrow(TakedownRequestError)
  })

  it("rejects a document that doesn't exist (or is deleted)", async () => {
    getDocumentMock.mockReturnValue(null)
    await expect(
      createTakedownRequest({ documentId: "doc_missing", message: "please remove this", files: [] }),
    ).rejects.toThrow("document not found")
    expect(insertTakedownRequestMock).not.toHaveBeenCalled()
  })

  it("rejects more than the max number of files", async () => {
    const files = Array.from({ length: MAX_TAKEDOWN_FILES + 1 }, (_, i) => makeFile(`f${i}.txt`, "x"))
    await expect(
      createTakedownRequest({ documentId: "doc_1", message: "please remove this", files }),
    ).rejects.toThrow(/at most/)
  })

  it("rejects a file over the size limit", async () => {
    const bigFile = { name: "big.bin", type: "application/octet-stream", size: 200 * 1024 * 1024 } as File
    await expect(
      createTakedownRequest({ documentId: "doc_1", message: "please remove this", files: [bigFile] }),
    ).rejects.toThrow("100MB")
  })

  it("records the request and stores evidence attachments scoped to it, without publishing to MFS", async () => {
    const result = await createTakedownRequest({
      documentId: "doc_1",
      message: "this is my personal information",
      files: [makeFile("evidence.png", "png-bytes", "image/png")],
    })

    expect(insertTakedownRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: "doc_1", message: "this is my personal information" }),
    )
    expect(insertAttachmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc_1",
        kind: "takedown_evidence",
        cid: "bafyevidence",
        fileName: "evidence.png",
        takedownRequestId: result.id,
      }),
    )
  })

  it("sanitizes a path-traversal filename in an evidence file", async () => {
    await createTakedownRequest({
      documentId: "doc_1",
      message: "please remove this",
      files: [makeFile("../../etc/passwd", "x")],
    })

    expect(addBytesMock).toHaveBeenCalledWith(expect.any(Uint8Array), "passwd")
  })

  it("does not fail the whole request when one evidence file fails to upload", async () => {
    addBytesMock.mockRejectedValue(new Error("ipfs down"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const result = await createTakedownRequest({
      documentId: "doc_1",
      message: "please remove this",
      files: [makeFile("evidence.png", "x")],
    })

    expect(result.id).toBeTruthy()
    expect(insertTakedownRequestMock).toHaveBeenCalled()
    expect(insertAttachmentMock).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it("allows a request with no evidence files at all", async () => {
    const result = await createTakedownRequest({ documentId: "doc_1", message: "please remove this", files: [] })
    expect(result.id).toBeTruthy()
    expect(insertAttachmentMock).not.toHaveBeenCalled()
  })
})
