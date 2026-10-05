export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of tags) {
    if (typeof raw !== "string") {
      continue
    }

    let tag = raw.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()

    if (tag.startsWith("#")) {
      tag = tag.slice(1)
    }

    if (tag === "" || seen.has(tag)) {
      continue
    }

    seen.add(tag)
    result.push(tag)
  }

  return result
}