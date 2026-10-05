import { ValidationError } from "@/types/note"
import { normalizeTags } from "@/lib/notes/tag-utils"

export function validateAndNormalizeTags(tags: readonly string[]): string[] {
  const normalized = normalizeTags(tags)

  for (const tag of normalized) {
    if (tag.includes(",")) {
      throw new ValidationError(`Tag "${tag}" cannot contain commas`)
    }
  }

  return normalized
}