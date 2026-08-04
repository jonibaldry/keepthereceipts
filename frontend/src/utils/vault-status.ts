import { createServerFn } from "@tanstack/react-start"

export interface VaultStatus {
  cid: string | null
  checkedAt: string
  gatewayUrl: string
  dnslinkDomain: string
}

export const getVaultStatus = createServerFn({ method: "GET" }).handler(async (): Promise<VaultStatus> => {
  const ipfsApiUrl = process.env.IPFS_API_URL || "http://127.0.0.1:5001"
  const gatewayUrl = process.env.IPFS_GATEWAY_URL || "https://ipfs.keepthereceipts.net"
  const dnslinkDomain = process.env.DNSLINK_DOMAIN || "keepthereceipts.net"
  const checkedAt = new Date().toISOString()
  try {
    const res = await fetch(`${ipfsApiUrl}/api/v0/files/stat?arg=%2Fvault`, {
      method: "POST",
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return { cid: null, checkedAt, gatewayUrl, dnslinkDomain }
    const body = (await res.json()) as { Hash?: string }
    return { cid: body.Hash ?? null, checkedAt, gatewayUrl, dnslinkDomain }
  } catch {
    return { cid: null, checkedAt, gatewayUrl, dnslinkDomain }
  }
})

// Cheap, no-fetch counterpart to getVaultStatus's IPFS root check — for
// routes that just need to build a gateway link, not the vault root state.
export const getGatewayUrl = createServerFn({ method: "GET" }).handler(async (): Promise<string> => {
  return process.env.IPFS_GATEWAY_URL || "https://ipfs.keepthereceipts.net"
})

// The app's own public URL — unrelated to IPFS, used to build absolute
// links back to itself (canonical link / og:url tags).
export const getBaseUrl = createServerFn({ method: "GET" }).handler(async (): Promise<string> => {
  return process.env.BASE_URL || "http://localhost:3000"
})

export function formatCheckedAt(iso: string): string {
  return iso.replace("T", " ").replace(/(\.\d+)?Z$/, " UTC")
}
