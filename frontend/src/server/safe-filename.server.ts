// file.name is attacker-controlled and untrusted: a caller posting FormData
// directly (rather than through a browser's file picker, which already
// strips any directory portion) can set it to anything, including
// "../../vault/vault.db". We only ever want the leaf filename — take the
// last path segment (defeating traversal regardless of how many ".." pieces
// precede it), strip control characters, and fall back to a safe default if
// nothing usable is left.
export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? ""
  const cleaned = base.replace(/[\x00-\x1f]/g, "").trim()
  if (!cleaned || cleaned === "." || cleaned === "..") {
    return "file"
  }
  return cleaned
}
