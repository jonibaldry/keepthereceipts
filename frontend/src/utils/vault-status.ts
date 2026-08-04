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

export function formatCheckedAt(iso: string): string {
  return iso.replace("T", " ").replace(/(\.\d+)?Z$/, " UTC")
}
