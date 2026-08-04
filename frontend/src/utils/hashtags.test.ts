import { describe, expect, it } from "vitest"
import { extractHashtags } from "./hashtags"

describe("extractHashtags", () => {
  it("extracts hashtags from plain text", () => {
    expect(extractHashtags("Electricity bill for #utilities #home-office")).toEqual(["utilities", "home"])
  })

  it("lowercases and dedupes", () => {
    expect(extractHashtags("#Receipt #receipt #RECEIPT")).toEqual(["receipt"])
  })

  it("returns an empty array when there are no hashtags", () => {
    expect(extractHashtags("just a plain description")).toEqual([])
  })

  it("ignores a bare hash with no following word characters", () => {
    expect(extractHashtags("price is # 12")).toEqual([])
  })

  it("preserves first-seen order", () => {
    expect(extractHashtags("#b then #a then #b again")).toEqual(["b", "a"])
  })
})
