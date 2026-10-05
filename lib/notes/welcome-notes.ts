import type { Note, NoteInput } from "@/types/note"
import type { NotesService } from "@/lib/notes/notes-service"
import type { SettingsRepository } from "@/lib/settings/settings-repository"

export interface WelcomeNote {
  input: NoteInput
  isPinned?: boolean
}

/**
 * First-run example notes. Content is Markdown source, matching how note
 * content is stored everywhere else in V1.
 */
export const WELCOME_NOTES: readonly WelcomeNote[] = [
  {
    isPinned: true,
    input: {
      title: "Welcome to Notable",
      content: [
        "This is your notebook. Everything here is stored on this device only.",
        "",
        "## Getting around",
        "",
        "- Switch between **All Notes**, **Pinned**, and tags from the top bar, or from the bottom bar on a phone.",
        "- Select a note to open it in the editor.",
        "- Press the pin button on any note in the list to pin or unpin it.",
        "- Press `Ctrl`/`Cmd` + `K` to jump straight to search.",
        "",
        "> Your notes should feel like your notebook.",
      ].join("\n"),
      tags: ["getting-started"],
    },
  },
  {
    input: {
      title: "Organize with tags",
      content: [
        "Tags turn a growing pile of notes into something you can actually find.",
        "",
        "## How tags work",
        "",
        "1. Add tags to a note in the editor.",
        "2. Every tag appears under **Tags** in the top bar with a note count.",
        "3. Select a tag to filter the list to just those notes.",
        "",
        "Tags are matched without case, so `Ideas` and `ideas` are the same tag.",
      ].join("\n"),
      tags: ["getting-started", "ideas"],
    },
  },
  {
    input: {
      title: "Search across everything",
      content: [
        "The search button in the top bar filters notes as you type.",
        "",
        "Search looks through note titles, note content, and tags, so a single",
        "word is often enough to find what you wrote months ago.",
        "",
        "This note exists to be deleted. Try the delete action, and notice that",
        "welcome notes are never re-created afterwards.",
      ].join("\n"),
      tags: ["getting-started"],
    },
  },
]

/**
 * Seeds the first-run notes at most once.
 *
 * The seed flag is persisted *before* any note is written. If creation fails
 * part-way through, the partially written notes are never duplicated on the
 * next load, which keeps "seed exactly once" true even after a failure.
 */
export async function ensureWelcomeNotes(
  service: NotesService,
  settings: SettingsRepository,
): Promise<Note[]> {
  const current = await settings.get()

  if (current.welcomeNotesSeeded) {
    return []
  }

  await settings.save({ ...current, welcomeNotesSeeded: true })

  const created: Note[] = []

  for (const welcomeNote of WELCOME_NOTES) {
    const note = await service.createNote(welcomeNote.input)

    created.push(
      welcomeNote.isPinned === true
        ? await service.togglePin(note.id)
        : note,
    )
  }

  return created
}