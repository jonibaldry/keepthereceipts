import { describe, expect, it } from "vitest"
import { TypeID } from "typeid-js"
import { generateUserId } from "./id.server"

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
})
