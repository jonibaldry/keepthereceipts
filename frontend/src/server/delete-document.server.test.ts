import { beforeEach, describe, expect, it, vi } from "vitest"

const { mfsRmMock, pinRmMock, getDocumentMock, markDocumentDeletedMock, deleteTakedownRequestsForDocumentMock } =
  vi.hoisted(() => ({
    mfsRmMock: vi.fn(),
    pinRmMock: vi.fn(),
    getDocumentMock: vi.fn(),
    markDocumentDeletedMock: vi.fn(),
    deleteTakedownRequestsForDocumentMock: vi.fn(),
  }))

vi.mock("./ipfs.server", () => ({
  mfsRm: mfsRmMock,
  pinRm: pinRmMock,
}))

vi.mock("./documents-db.server", () => ({
  getDocument: getDocumentMock,
  markDocumentDeleted: markDocumentDeletedMock,
}))

vi.mock("./users-db.server", () => ({
  deleteTakedownRequestsForDocument: deleteTakedownRequestsForDocumentMock,
}))

import { deleteDocument, DeleteDocumentError } from "./delete-document.server"

describe("deleteDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mfsRmMock.mockResolvedValue(undefined)
    pinRmMock.mockResolvedValue(undefined)
    deleteTakedownRequestsForDocumentMock.mockReturnValue([])
  })

  it("throws when the document does not exist", async () => {
    getDocumentMock.mockReturnValue(null)
    await expect(deleteDocument("doc_missing")).rejects.toThrow(DeleteDocumentError)
    expect(markDocumentDeletedMock).not.toHaveBeenCalled()
  })

  it("flags the document deleted in the db before touching IPFS", async () => {
    const callOrder: string[] = []
    getDocumentMock.mockReturnValue({ id: "doc_1", attachments: [] })
    markDocumentDeletedMock.mockImplementation(() => callOrder.push("db"))
    mfsRmMock.mockImplementation(async () => {
      callOrder.push("mfs")
    })

    await deleteDocument("doc_1")

    expect(callOrder).toEqual(["db", "mfs"])
    expect(mfsRmMock).toHaveBeenCalledWith("/vault/document/doc_1")
  })

  it("unpins every attachment that has a cid", async () => {
    getDocumentMock.mockReturnValue({
      id: "doc_1",
      attachments: [
        { kind: "file", cid: "bafyfile" },
        { kind: "screenshot", cid: "bafyshot" },
        { kind: "archive", cid: null },
      ],
    })

    await deleteDocument("doc_1")

    expect(pinRmMock).toHaveBeenCalledWith("bafyfile")
    expect(pinRmMock).toHaveBeenCalledWith("bafyshot")
    expect(pinRmMock).toHaveBeenCalledTimes(2)
  })

  it("does not throw when MFS removal fails — the db flag is the source of truth", async () => {
    getDocumentMock.mockReturnValue({ id: "doc_1", attachments: [{ kind: "file", cid: "bafyfile" }] })
    mfsRmMock.mockRejectedValue(new Error("ipfs down"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(deleteDocument("doc_1")).resolves.toBeUndefined()
    expect(markDocumentDeletedMock).toHaveBeenCalledWith("doc_1")
    expect(pinRmMock).toHaveBeenCalledWith("bafyfile")

    errorSpy.mockRestore()
  })

  it("does not throw when unpinning a single attachment fails, and still attempts the rest", async () => {
    getDocumentMock.mockReturnValue({
      id: "doc_1",
      attachments: [
        { kind: "file", cid: "bafyfile" },
        { kind: "screenshot", cid: "bafyshot" },
      ],
    })
    pinRmMock.mockImplementation(async (cid: string) => {
      if (cid === "bafyfile") throw new Error("not pinned")
    })
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(deleteDocument("doc_1")).resolves.toBeUndefined()
    expect(pinRmMock).toHaveBeenCalledWith("bafyshot")

    errorSpy.mockRestore()
  })

  it("clears any open takedown requests for the document and unpins their evidence", async () => {
    getDocumentMock.mockReturnValue({ id: "doc_1", attachments: [] })
    deleteTakedownRequestsForDocumentMock.mockReturnValue(["bafyevidence1", "bafyevidence2"])

    await deleteDocument("doc_1")

    expect(deleteTakedownRequestsForDocumentMock).toHaveBeenCalledWith("doc_1")
    expect(pinRmMock).toHaveBeenCalledWith("bafyevidence1")
    expect(pinRmMock).toHaveBeenCalledWith("bafyevidence2")
  })

  it("does not throw when unpinning takedown evidence fails", async () => {
    getDocumentMock.mockReturnValue({ id: "doc_1", attachments: [] })
    deleteTakedownRequestsForDocumentMock.mockReturnValue(["bafyevidence1"])
    pinRmMock.mockRejectedValue(new Error("not pinned"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(deleteDocument("doc_1")).resolves.toBeUndefined()

    errorSpy.mockRestore()
  })
})
