import type { Note } from "@/types/note"

export type NotesStatus = "loading" | "ready" | "error"

export interface NotesState {
  status: NotesStatus
  notes: Note[]
  loadError: Error | null
  mutationError: Error | null
}

export type NotesAction =
  | { type: "loadStarted" }
  | { type: "loadSucceeded"; notes: Note[] }
  | { type: "loadFailed"; error: Error }
  | { type: "mutationFailed"; error: Error }
  | { type: "mutationErrorCleared" }
  | { type: "noteUpserted"; note: Note }
  | { type: "noteDeleted"; id: string }
  | { type: "notesReordered"; notes: Note[] }

export const initialNotesState: NotesState = {
  status: "loading",
  notes: [],
  loadError: null,
  mutationError: null,
}

function upsertNote(notes: readonly Note[], note: Note): Note[] {
  const index = notes.findIndex((candidate) => candidate.id === note.id)

  if (index === -1) {
    return [...notes, note]
  }

  const next = [...notes]
  next[index] = note

  return next
}

export function notesReducer(
  state: NotesState,
  action: NotesAction,
): NotesState {
  switch (action.type) {
    case "loadStarted":
      return { ...state, status: "loading", loadError: null }

    case "loadSucceeded":
      return {
        ...state,
        status: "ready",
        notes: [...action.notes],
        loadError: null,
      }

    case "loadFailed":
      return { ...state, status: "error", loadError: action.error }

    case "mutationFailed":
      return { ...state, mutationError: action.error }

    case "mutationErrorCleared":
      return { ...state, mutationError: null }

    case "noteUpserted":
      return { ...state, notes: upsertNote(state.notes, action.note) }

    case "noteDeleted":
      return {
        ...state,
        notes: state.notes.filter((note) => note.id !== action.id),
      }

    case "notesReordered":
      return { ...state, notes: [...action.notes] }
  }
}