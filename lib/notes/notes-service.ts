import {
  type Note,
  type NoteInput,
  type NoteUpdate,
  ValidationError,
} from "@/types/note"
import {
  NoteNotFoundError,
  type NotesRepository,
} from "@/lib/notes/notes-repository"
import { validateAndNormalizeTags } from "@/lib/notes/validators"

export class NotesService {
  private readonly repository: NotesRepository

  constructor(repository: NotesRepository) {
    this.repository = repository
  }

  getNotes(): Promise<Note[]> {
    return this.repository.getAll()
  }

  async createNote(input: NoteInput): Promise<Note> {
    return this.repository.create({
      title: input.title,
      content: input.content,
      tags: validateAndNormalizeTags(input.tags),
    })
  }

  async updateNote(id: string, patch: NoteUpdate): Promise<Note> {
    return this.repository.update(id, this.normalizePatch(patch))
  }

  deleteNote(id: string): Promise<void> {
    return this.repository.delete(id)
  }

  async togglePin(id: string): Promise<Note> {
    const current = await this.repository.getById(id)

    if (current === null) {
      throw new NoteNotFoundError(id)
    }

    return this.repository.update(id, { isPinned: !current.isPinned })
  }

  async reorderNotes(orderedIds: readonly string[]): Promise<Note[]> {
    const current = await this.repository.getAll()
    const present = new Set(current.map((note) => note.id))
    const seen = new Set<string>()

    for (const id of orderedIds) {
      if (seen.has(id) || !present.has(id)) {
        throw new ValidationError(
          "Reorder must include every note exactly once",
        )
      }

      seen.add(id)
    }

    if (seen.size !== current.length) {
      throw new ValidationError("Reorder must include every note exactly once")
    }

    if (current.every((note, index) => note.id === orderedIds[index])) {
      return current
    }

    return this.repository.reorder(orderedIds)
  }

  private normalizePatch(patch: NoteUpdate): NoteUpdate {
    if (patch.tags === undefined) {
      return patch
    }

    return { ...patch, tags: validateAndNormalizeTags(patch.tags) }
  }
}