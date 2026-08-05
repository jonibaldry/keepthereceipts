import { describe, expect, it } from "vitest"
import { TypeID } from "typeid-js"
import {
  generateAttachmentId,
  generateDocumentId,
  generateTakedownAttachmentId,
  generateTakedownRequestId,
  generateUserId,
} from "./id.server"

describe("id.server", () => {
  it("generates an id prefixed with user_", () => {
    expect(generateUserId()).toMatch(/^user_[0-9a-z]+$/)
  })

  it("generates a valid, round-trippable TypeID", () => {
    const id = generateUserId()
    const parsed = TypeID.fromString(id, "user")
    expect(parsed.toString()).toBe(id)
  })

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateUserId()))
    expect(ids.size).toBe(20)
  })

  it("generates a document id prefixed with doc_", () => {
    const id = generateDocumentId()
    expect(id).toMatch(/^doc_[0-9a-z]+$/)
    expect(TypeID.fromString(id, "doc").toString()).toBe(id)
  })

  it("generates an attachment id prefixed with att_", () => {
    const id = generateAttachmentId()
    expect(id).toMatch(/^att_[0-9a-z]+$/)
    expect(TypeID.fromString(id, "att").toString()).toBe(id)
  })

  it("generates a takedown request id prefixed with takedown_", () => {
    const id = generateTakedownRequestId()
    expect(id).toMatch(/^takedown_[0-9a-z]+$/)
    expect(TypeID.fromString(id, "takedown").toString()).toBe(id)
  })

  it("generates a takedown attachment id prefixed with takedownatt_", () => {
    const id = generateTakedownAttachmentId()
    expect(id).toMatch(/^takedownatt_[0-9a-z]+$/)
    expect(TypeID.fromString(id, "takedownatt").toString()).toBe(id)
  })
})
