function ipfsApiUrl(): string {
  return process.env.IPFS_API_URL || "http://127.0.0.1:5001"
}

async function ipfsApiPost(path: string, params: Record<string, string | string[]>): Promise<Response> {
  const url = new URL(path, ipfsApiUrl())
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, v)
    }
  }
  const res = await fetch(url, { method: "POST" })
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`)
  }
  return res
}

export interface IpfsAddResult {
  cid: string
  size: number
}

// Adds raw bytes as a single file to IPFS (pinned, CIDv1) without touching
// MFS — callers place it into the vault's MFS tree with mfsCp once the
// upload is confirmed good, keeping "content exists in IPFS" separate from
// "content is part of the published vault root".
export async function addBytesToIpfs(bytes: Uint8Array, filename: string): Promise<IpfsAddResult> {
  const form = new FormData()
  // Uint8Array/Buffer are valid BlobPart values at runtime; the cast works
  // around overly strict dom typings that reject SharedArrayBuffer-backed
  // views even when the actual buffer is a plain ArrayBuffer.
  form.append("file", new Blob([bytes as BlobPart]), filename)

  const url = new URL("/api/v0/add", ipfsApiUrl())
  url.searchParams.set("cid-version", "1")
  url.searchParams.set("pin", "true")

  const res = await fetch(url, { method: "POST", body: form })
  if (!res.ok) {
    throw new Error(`ipfs add failed: ${res.status} ${await res.text()}`)
  }

  // kubo emits one JSON object per line; for a single small file that's
  // just one line, but we take the last non-empty line defensively.
  const lines = (await res.text()).trim().split("\n").filter(Boolean)
  const added = JSON.parse(lines[lines.length - 1]) as { Hash: string; Size: string }
  return { cid: added.Hash, size: Number(added.Size) }
}

export async function mfsMkdirP(path: string): Promise<void> {
  await ipfsApiPost("/api/v0/files/mkdir", { arg: path, parents: "true" })
}

export async function mfsCp(cid: string, destPath: string): Promise<void> {
  await ipfsApiPost("/api/v0/files/cp", { arg: [`/ipfs/${cid}`, destPath] })
}
