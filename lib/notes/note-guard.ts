import type { Note } from "@/types/note"

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

function isIsoUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_UTC_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  )
}

export function isNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === "string" &&
    candidate.id !== "" &&
    typeof candidate.title === "string" &&
    typeof candidate.content === "string" &&
    isIsoUtcTimestamp(candidate.createdAt) &&
    isIsoUtcTimestamp(candidate.updatedAt) &&
    typeof candidate.isPinned === "boolean" &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === "string")
  )
}

export function parseNotes(value: unknown): Note[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const notes: Note[] = []

  for (const entry of value) {
    if (!isNote(entry)) {
      return null
    }
    notes.push(entry)
  }

  return notes
}