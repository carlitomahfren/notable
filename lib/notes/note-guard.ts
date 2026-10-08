import type { Note } from "@/types/note"

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/

function isIsoUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_UTC_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  )
}

export type LegacyNote = Omit<Note, "order">

function hasNoteFields(value: unknown): value is LegacyNote {
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

export function isNote(value: unknown): value is Note {
  return (
    hasNoteFields(value) &&
    typeof (value as Record<string, unknown>).order === "number"
  )
}

/**
 * A V1 note written before manual ordering existed: every field a note needs
 * except `order`, which is what the migration fills in from the stored slot.
 */
export function isLegacyNote(value: unknown): value is LegacyNote {
  return (
    hasNoteFields(value) &&
    (value as Record<string, unknown>).order === undefined
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

/**
 * Upgrades a stored list that predates ordering. Each legacy note is given the
 * slot it already occupies, so the first visual order a user sees is the array
 * they always had; returns null the moment anything is neither a current nor a
 * legacy note, so corrupt data is rejected rather than silently dropped.
 */
export function migrateLegacyNotes(value: unknown): Note[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const notes: Note[] = []

  for (const [index, entry] of value.entries()) {
    if (!isLegacyNote(entry)) {
      return null
    }
    notes.push({ ...entry, order: index })
  }

  return notes
}