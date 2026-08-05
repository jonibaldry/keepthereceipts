import { beforeEach, describe, expect, it, vi } from "vitest"

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }))

vi.mock("node:dns/promises", () => ({ lookup: lookupMock }))

import { assertPublicHostname, isBlockedAddress, UnsafeUrlError } from "./network-guard.server"

describe("isBlockedAddress", () => {
  it.each([
    ["10.0.0.5", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["172.32.0.1", false],
    ["192.168.1.1", true],
    ["127.0.0.1", true],
    ["169.254.169.254", true], // cloud metadata
    ["100.64.0.1", true], // carrier-grade NAT
    ["0.0.0.0", true],
    ["255.255.255.255", true],
    ["224.0.0.1", true],
    ["8.8.8.8", false],
    ["93.184.216.34", false],
  ])("classifies IPv4 %s as blocked=%s", (ip, blocked) => {
    expect(isBlockedAddress(ip)).toBe(blocked)
  })

  it.each([
    ["::1", true],
    ["fe80::1", true],
    ["fc00::1", true],
    ["fd12:3456::1", true],
    ["ff02::1", true],
    ["::ffff:127.0.0.1", true],
    ["::ffff:8.8.8.8", false],
    ["2001:4860:4860::8888", false],
  ])("classifies IPv6 %s as blocked=%s", (ip, blocked) => {
    expect(isBlockedAddress(ip)).toBe(blocked)
  })

  it("treats a non-IP string as blocked", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true)
  })
})

describe("assertPublicHostname", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects a private IPv4 literal without doing a DNS lookup", async () => {
    await expect(assertPublicHostname("127.0.0.1")).rejects.toThrow(UnsafeUrlError)
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it("rejects localhost without doing a DNS lookup", async () => {
    await expect(assertPublicHostname("localhost")).rejects.toThrow(UnsafeUrlError)
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it("allows a public IPv4 literal", async () => {
    await expect(assertPublicHostname("93.184.216.34")).resolves.toBeUndefined()
  })

  it("rejects a hostname that resolves to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }])
    await expect(assertPublicHostname("metadata.internal")).rejects.toThrow(UnsafeUrlError)
  })

  it("rejects a hostname when only one of several resolved addresses is private", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ])
    await expect(assertPublicHostname("example.com")).rejects.toThrow(UnsafeUrlError)
  })

  it("allows a hostname whose resolved addresses are all public", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }])
    await expect(assertPublicHostname("example.com")).resolves.toBeUndefined()
  })

  it("rejects a hostname that fails to resolve", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"))
    await expect(assertPublicHostname("nonexistent.invalid")).rejects.toThrow(UnsafeUrlError)
  })
})
