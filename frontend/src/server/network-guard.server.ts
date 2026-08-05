import { isIP } from "node:net"
import { lookup } from "node:dns/promises"

// Rejects requests aimed at internal/private/reserved network space so
// user-supplied URLs (source URL capture, and anything else that fetches
// on the server's behalf) can't be used for SSRF — including against
// addresses only reachable from inside our own network, like the IPFS API
// or a cloud metadata endpoint.
export class UnsafeUrlError extends Error {}

function ipv4Blocked(ip: string): boolean {
  const parts = ip.split(".").map(Number)
  const [a, b, c] = parts
  if (a === 0) return true // 0.0.0.0/8 — "this network"
  if (a === 10) return true // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 — carrier-grade NAT
  if (a === 127) return true // 127.0.0.0/8 — loopback
  if (a === 169 && b === 254) return true // 169.254.0.0/16 — link-local, incl. cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true // 192.0.0.0/24 — IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true // 192.0.2.0/24 — documentation (TEST-NET-1)
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18.0.0/15 — benchmarking
  if (a === 198 && b === 51 && c === 100) return true // 198.51.100.0/24 — documentation (TEST-NET-2)
  if (a === 203 && b === 0 && c === 113) return true // 203.0.113.0/24 — documentation (TEST-NET-3)
  if (a >= 224) return true // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved, 255.255.255.255 broadcast
  return false
}

function ipv6Blocked(ip: string): boolean {
  const norm = ip.toLowerCase()
  if (norm === "::1" || norm === "::") return true // loopback / unspecified
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true // fc00::/7 — unique local
  if (/^fe[89ab]/.test(norm)) return true // fe80::/10 — link-local
  if (norm.startsWith("ff")) return true // ff00::/8 — multicast

  // IPv4-mapped/-compatible addresses embed a v4 address that needs the same check.
  const mapped = norm.match(/(?:^::ffff:)(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return ipv4Blocked(mapped[1])
  return false
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip)
  if (family === 4) return ipv4Blocked(ip)
  if (family === 6) return ipv6Blocked(ip)
  return true // not a recognizable literal — treat conservatively as blocked
}

// Resolves every address a hostname answers to and rejects if any of them
// land in private/reserved space. Called both up front (for a fast, clear
// error at document-creation time) and per-request during capture (see
// capture.server.ts), since the two checks happen at different times and
// DNS can answer differently between them.
export async function assertPublicHostname(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new UnsafeUrlError(`"${hostname}" is not a public address`)
    }
    return
  }
  if (hostname.toLowerCase() === "localhost") {
    throw new UnsafeUrlError(`"${hostname}" is not a public address`)
  }

  let addresses: { address: string }[]
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new UnsafeUrlError(`could not resolve "${hostname}"`)
  }
  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new UnsafeUrlError(`"${hostname}" resolves to a non-public address`)
  }
}
