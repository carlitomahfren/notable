import type { Note } from "@/types/note"

let sequence = 0

export function resetNoteIds(): void {
  sequence = 0
}

export function makeNote(overrides: Partial<Note> = {}): Note {
  sequence += 1

  return {
    id: `note-${sequence}`,
    title: "Note",
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    isPinned: false,
    tags: [],
    ...overrides,
  }
}