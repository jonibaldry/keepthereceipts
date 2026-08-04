const HASHTAG_PATTERN = /#([a-z0-9_]+)/gi

export function extractHashtags(description: string): string[] {
  const seen = new Set<string>()
  for (const match of description.matchAll(HASHTAG_PATTERN)) {
    seen.add(match[1].toLowerCase())
  }
  return [...seen]
}
