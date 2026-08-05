import { beforeEach, describe, expect, it, vi } from "vitest"

const { addBytesMock, mfsCpMock, mfsMkdirPMock, captureAndStoreMock, insertDocumentMock, insertTagsMock, insertAttachmentMock, getDocumentMock } =
  vi.hoisted(() => ({
    addBytesMock: vi.fn(),
    mfsCpMock: vi.fn(),
    mfsMkdirPMock: vi.fn(),
    captureAndStoreMock: vi.fn(),
    insertDocumentMock: vi.fn(),
    insertTagsMock: vi.fn(),
    insertAttachmentMock: vi.fn(),
    getDocumentMock: vi.fn(),
  }))

vi.mock("./ipfs.server", () => ({
  addBytesToIpfs: addBytesMock,
  mfsCp: mfsCpMock,
  mfsMkdirP: mfsMkdirPMock,
}))

vi.mock("./capture.server", () => ({
  captureAndStore: captureAndStoreMock,
}))

vi.mock("./documents-db.server", () => ({
  insertDocument: insertDocumentMock,
  insertDocumentTags: insertTagsMock,
  insertAttachment: insertAttachmentMock,
  getDocument: getDocumentMock,
}))

import { createDocument, CreateDocumentError, MAX_FILE_SIZE_BYTES } from "./create-document.server"

function makeFile(name: string, content: string, type = "text/plain"): File {
  return new File([content], name, { type })
}

describe("createDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mfsMkdirPMock.mockResolvedValue(undefined)
    mfsCpMock.mockResolvedValue(undefined)
    addBytesMock.mockImplementation(async (_bytes: Uint8Array, name: string) => ({
      cid: name.endsWith(".metadata") ? "bafymetadata" : "bafyfile",
      size: 11,
    }))
    getDocumentMock.mockImplementation((id: string) => ({
      id,
      userId: "user_1",
      title: "stub",
      description: "",
      sourceUrl: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      tags: [],
      attachments: [],
    }))
  })

  it("rejects an empty title", async () => {
    await expect(
      createDocument({ userId: "user_1", title: "  ", description: "", sourceUrl: "", file: makeFile("a.txt", "x") }),
    ).rejects.toThrow(CreateDocumentError)
  })

  it("allows creating a document with no file at all", async () => {
    await createDocument({ userId: "user_1", title: "Just a note", description: "", sourceUrl: "", file: null })

    expect(addBytesMock).toHaveBeenCalledWith(expect.any(Uint8Array), expect.stringMatching(/\.metadata$/))
    expect(insertDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Just a note", sourceUrl: null }),
    )
    expect(insertAttachmentMock).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "file" }))
  })

  it("treats an empty (no-selection) file input the same as no file", async () => {
    const emptyFile = makeFile("", "")
    await createDocument({ userId: "user_1", title: "No file chosen", description: "", sourceUrl: "", file: emptyFile })

    expect(insertAttachmentMock).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "file" }))
  })

  it("rejects a file over the 100MB limit", async () => {
    const bigFile = { name: "big.bin", type: "application/octet-stream", size: MAX_FILE_SIZE_BYTES + 1 } as File
    await expect(
      createDocument({ userId: "user_1", title: "Big file", description: "", sourceUrl: "", file: bigFile }),
    ).rejects.toThrow("100MB")
  })

  it("rejects an invalid source URL", async () => {
    await expect(
      createDocument({
        userId: "user_1",
        title: "Electric bill",
        description: "",
        sourceUrl: "not a url",
        file: makeFile("a.txt", "x"),
      }),
    ).rejects.toThrow("valid URL")
  })

  it("rejects a non-http(s) source URL", async () => {
    await expect(
      createDocument({
        userId: "user_1",
        title: "Electric bill",
        description: "",
        sourceUrl: "ftp://example.com/file",
        file: makeFile("a.txt", "x"),
      }),
    ).rejects.toThrow("http or https")
  })

  it("uploads the file to IPFS/MFS and inserts a file attachment with extracted tags", async () => {
    await createDocument({
      userId: "user_1",
      title: "Electric bill",
      description: "paid via #directdebit #utilities",
      sourceUrl: "",
      file: makeFile("bill.pdf", "pdf-bytes", "application/pdf"),
    })

    expect(addBytesMock).toHaveBeenCalledWith(expect.any(Uint8Array), "bill.pdf")
    expect(mfsMkdirPMock).toHaveBeenCalledWith(expect.stringMatching(/^\/document\/doc_/))
    expect(mfsCpMock).toHaveBeenCalledWith("bafyfile", expect.stringMatching(/^\/document\/doc_.*\/bill\.pdf$/))

    const fileAttachment = insertAttachmentMock.mock.calls.find((call) => call[0].kind === "file")?.[0]
    expect(fileAttachment).toMatchObject({
      kind: "file",
      status: "complete",
      cid: "bafyfile",
      fileName: "bill.pdf",
      mimeType: "application/pdf",
      fileSize: 9,
    })
    expect(insertTagsMock).toHaveBeenCalledWith(expect.any(String), ["directdebit", "utilities"])
    expect(captureAndStoreMock).not.toHaveBeenCalled()
  })

  it("writes a <document_id>.metadata JSON file after the DB rows are created and records it as an attachment", async () => {
    await createDocument({
      userId: "user_1",
      title: "Electric bill",
      description: "",
      sourceUrl: "",
      file: null,
    })

    const documentId = insertDocumentMock.mock.calls[0][0].id
    expect(mfsCpMock).toHaveBeenCalledWith("bafymetadata", `/document/${documentId}/${documentId}.metadata`)
    // getDocument (the full record) must be fetched before the metadata
    // write, so the export reflects tags/attachments, not just the insert.
    expect(getDocumentMock).toHaveBeenCalledWith(documentId)

    const metadataAttachment = insertAttachmentMock.mock.calls.find((call) => call[0].kind === "metadata")?.[0]
    expect(metadataAttachment).toMatchObject({
      kind: "metadata",
      status: "complete",
      cid: "bafymetadata",
      fileName: `${documentId}.metadata`,
      mimeType: "application/json",
    })
  })

  it("does not fail document creation or record an attachment when the metadata file write fails", async () => {
    addBytesMock.mockImplementation(async (_bytes: Uint8Array, name: string) => {
      if (name.endsWith(".metadata")) throw new Error("ipfs down")
      return { cid: "bafyfile", size: 11 }
    })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const document = await createDocument({
      userId: "user_1",
      title: "Electric bill",
      description: "",
      sourceUrl: "",
      file: null,
    })

    expect(document).toBeTruthy()
    expect(insertAttachmentMock).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "metadata" }))
    errorSpy.mockRestore()
  })

  it("wraps a file IPFS add failure as a storage_unavailable CreateDocumentError and creates nothing", async () => {
    addBytesMock.mockImplementation(async (_bytes: Uint8Array, name: string) => {
      if (name === "bill.pdf") throw new Error("connect ECONNREFUSED 127.0.0.1:5001")
      return { cid: "bafymetadata", size: 11 }
    })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(
      createDocument({
        userId: "user_1",
        title: "Electric bill",
        description: "",
        sourceUrl: "",
        file: makeFile("bill.pdf", "pdf-bytes", "application/pdf"),
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("temporarily unavailable"), code: "storage_unavailable" })

    expect(insertDocumentMock).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it("creates pending screenshot/archive attachments with mime types and fires the background capture when a source URL is given", async () => {
    captureAndStoreMock.mockResolvedValue(undefined)

    await createDocument({
      userId: "user_1",
      title: "Electric bill",
      description: "",
      sourceUrl: "https://example.com/bill",
      file: null,
    })

    const documentId = insertDocumentMock.mock.calls[0][0].id
    const screenshotAttachment = insertAttachmentMock.mock.calls.find((call) => call[0].kind === "screenshot")?.[0]
    const archiveAttachment = insertAttachmentMock.mock.calls.find((call) => call[0].kind === "archive")?.[0]

    expect(screenshotAttachment).toMatchObject({ status: "pending", cid: null, mimeType: "image/png" })
    expect(archiveAttachment).toMatchObject({ status: "pending", cid: null, mimeType: "multipart/related" })
    expect(captureAndStoreMock).toHaveBeenCalledWith(
      documentId,
      "https://example.com/bill",
      screenshotAttachment.id,
      archiveAttachment.id,
    )
  })
})
