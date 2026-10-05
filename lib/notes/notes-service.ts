import type { Note, NoteInput, NoteUpdate } from "@/types/note"
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

  private normalizePatch(patch: NoteUpdate): NoteUpdate {
    if (patch.tags === undefined) {
      return patch
    }

    return { ...patch, tags: validateAndNormalizeTags(patch.tags) }
  }
}