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
import { enforcePinnedFirst } from "@/lib/notes/reorder"
import { validateAndNormalizeTags } from "@/lib/notes/validators"

function pinnedIdsOf(notes: readonly Note[]): ReadonlySet<string> {
  return new Set(notes.filter((note) => note.isPinned).map((note) => note.id))
}

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
    const updated = await this.repository.update(id, this.normalizePatch(patch))

    if (patch.isPinned === undefined) {
      return updated
    }

    /*
     * The patch moved the note between the pinned and the unpinned region, and
     * the regions are the top of the list, so the stored order may now describe
     * something the sort would never return.
     */
    const notes = await this.writePinnedFirst()

    return notes.find((note) => note.id === id) ?? updated
  }

  deleteNote(id: string): Promise<void> {
    return this.repository.delete(id)
  }

  async togglePin(id: string): Promise<Note> {
    const current = await this.repository.getById(id)

    if (current === null) {
      throw new NoteNotFoundError(id)
    }

    const updated = await this.repository.update(id, {
      isPinned: !current.isPinned,
    })
    const notes = await this.writePinnedFirst()

    return notes.find((note) => note.id === id) ?? updated
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

    const canonical = enforcePinnedFirst(orderedIds, pinnedIdsOf(current))

    if (current.every((note, index) => note.id === canonical[index])) {
      return current
    }

    return this.repository.reorder(canonical)
  }

  /**
   * Rewrites the stored order until it reads the way the list is sorted: pinned
   * notes first, and each region in the order it was already in. Returns the
   * list as it now stands, which is what a caller needs when a note's own
   * position changed as a result of the write.
   */
  private async writePinnedFirst(): Promise<Note[]> {
    const notes = await this.repository.getAll()
    const canonical = enforcePinnedFirst(
      notes.map((note) => note.id),
      pinnedIdsOf(notes),
    )

    if (notes.every((note, index) => note.id === canonical[index])) {
      return notes
    }

    return this.repository.reorder(canonical)
  }

  private normalizePatch(patch: NoteUpdate): NoteUpdate {
    if (patch.tags === undefined) {
      return patch
    }

    return { ...patch, tags: validateAndNormalizeTags(patch.tags) }
  }
}