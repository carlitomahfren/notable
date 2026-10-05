import type { Note, NoteInput, NoteUpdate } from "@/types/note"
import { readJson, writeJson } from "@/lib/storage/local-storage"
import { parseNotes } from "@/lib/notes/note-guard"

export const NOTES_STORAGE_KEY = "notes-app.notes"

export interface NotesRepository {
  getAll(): Promise<Note[]>
  getById(id: string): Promise<Note | null>
  create(input: NoteInput): Promise<Note>
  update(id: string, input: NoteUpdate): Promise<Note>
  delete(id: string): Promise<void>
}

export class NotesStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotesStorageError"
  }
}

export class NoteNotFoundError extends Error {
  constructor(id: string) {
    super(`Note "${id}" was not found`)
    this.name = "NoteNotFoundError"
  }
}

function createNoteId(): string {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new NotesStorageError("crypto.randomUUID is not available")
  }
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

export class LocalStorageNotesRepository implements NotesRepository {
  async getAll(): Promise<Note[]> {
    const result = readJson<unknown>(NOTES_STORAGE_KEY)

    if (result.status === "absent") {
      return []
    }

    if (result.status === "corrupt") {
      throw new NotesStorageError(
        `Stored notes could not be read: ${result.reason}`,
      )
    }

    if (!Array.isArray(result.value)) {
      throw new NotesStorageError("Stored notes are not a valid list")
    }

    const notes = parseNotes(result.value)

    if (notes === null) {
      throw new NotesStorageError("Stored notes contain an invalid note")
    }

    return notes
  }

  async getById(id: string): Promise<Note | null> {
    const notes = await this.getAll()
    return notes.find((note) => note.id === id) ?? null
  }

  async create(input: NoteInput): Promise<Note> {
    const notes = await this.getAll()
    const timestamp = nowIso()

    const note: Note = {
      id: createNoteId(),
      title: input.title,
      content: input.content,
      createdAt: timestamp,
      updatedAt: timestamp,
      isPinned: false,
      tags: [...input.tags],
    }

    this.persist([...notes, note])

    return note
  }

  async update(id: string, input: NoteUpdate): Promise<Note> {
    const notes = await this.getAll()
    const index = notes.findIndex((note) => note.id === id)

    if (index === -1) {
      throw new NoteNotFoundError(id)
    }

    const current = notes[index]
    const next: Note = { ...current }

    if (input.title !== undefined) {
      next.title = input.title
    }
    if (input.content !== undefined) {
      next.content = input.content
    }
    if (input.tags !== undefined) {
      next.tags = [...input.tags]
    }
    if (input.isPinned !== undefined) {
      next.isPinned = input.isPinned
    }

    const touchesContent =
      input.title !== undefined ||
      input.content !== undefined ||
      input.tags !== undefined

    // Pinning is deliberately excluded: it must not move updatedAt.
    if (touchesContent) {
      next.updatedAt = nowIso()
    }

    notes[index] = next
    this.persist(notes)

    return next
  }

  async delete(id: string): Promise<void> {
    const notes = await this.getAll()
    const remaining = notes.filter((note) => note.id !== id)

    if (remaining.length === notes.length) {
      return
    }

    this.persist(remaining)
  }

  private persist(notes: Note[]): void {
    try {
      writeJson(NOTES_STORAGE_KEY, notes)
    } catch (error) {
      throw new NotesStorageError(
        `Notes could not be saved: ${
          error instanceof Error ? error.message : "storage write failed"
        }`,
      )
    }
  }
}