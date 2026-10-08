import type { Note } from "@/types/note"

export const UNTITLED_NOTE_LABEL = "Untitled"

export type NoteFilter =
  | { kind: "all" }
  | { kind: "pinned" }
  | { kind: "tags" }
  | { kind: "tag"; tag: string }

export interface TagSummary {
  tag: string
  count: number
}

export interface VisibleNotesQuery {
  filter: NoteFilter
  searchQuery: string
}

export function getDisplayTitle(note: Note): string {
  const title = note.title.trim()

  return title === "" ? UNTITLED_NOTE_LABEL : title
}

export function searchNotes(notes: readonly Note[], query: string): Note[] {
  const needle = query.trim().toLowerCase()

  if (needle === "") {
    return [...notes]
  }

  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(needle) ||
      note.content.toLowerCase().includes(needle) ||
      note.tags.some((tag) => tag.toLowerCase().includes(needle)),
  )
}

export function filterNotes(notes: readonly Note[], filter: NoteFilter): Note[] {
  if (filter.kind === "pinned") {
    return notes.filter((note) => note.isPinned)
  }

  if (filter.kind === "tag") {
    const target = filter.tag.trim().toLowerCase()

    return notes.filter((note) =>
      note.tags.some((tag) => tag.trim().toLowerCase() === target),
    )
  }

  return [...notes]
}

export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1
    }

    const byUpdatedAt = Date.parse(b.updatedAt) - Date.parse(a.updatedAt)

    if (byUpdatedAt !== 0) {
      return byUpdatedAt
    }

    return a.id.localeCompare(b.id)
  })
}

export function getVisibleNotes(
  notes: readonly Note[],
  { filter, searchQuery }: VisibleNotesQuery,
): Note[] {
  return sortNotes(filterNotes(searchNotes(notes, searchQuery), filter))
}

export function getTagSummaries(notes: readonly Note[]): TagSummary[] {
  const counts = new Map<string, number>()

  for (const note of notes) {
    const seen = new Set<string>()

    for (const tag of note.tags) {
      if (seen.has(tag)) {
        continue
      }

      seen.add(tag)
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
  )
}

export const DEFAULT_EXCERPT_LENGTH = 140

/**
 * Reduces Markdown source to readable plain text for list previews.
 * This is presentation only: it never parses or renders Markdown, and
 * nothing derived is written back to the note.
 */
export function toPlainText(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}([-*+]|\d+[.)])\s+/gm, "")
    .replace(/^\s{0,3}([-*_]\s*){3,}$/gm, " ")
    .replace(/^\s{0,3}\|.*\|\s*$/gm, (row) => row.replace(/\|/g, " "))
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Builds a single-line preview from note content. Derived on demand so no
 * excerpt, word count, or search text is ever persisted.
 */
export function getNoteExcerpt(
  note: Note,
  maxLength: number = DEFAULT_EXCERPT_LENGTH,
): string {
  const plain = toPlainText(note.content)

  if (maxLength <= 0) {
    return ""
  }

  if (plain.length <= maxLength) {
    return plain
  }

  const clipped = plain.slice(0, maxLength)
  const lastBoundary = clipped.lastIndexOf(" ")
  const body =
    lastBoundary > maxLength * 0.5 ? clipped.slice(0, lastBoundary) : clipped

  return `${body.trimEnd()}…`
}