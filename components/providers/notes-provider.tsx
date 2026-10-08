"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react"

import type { Note, NoteInput, NoteUpdate } from "@/types/note"
import { createMutationQueue } from "@/lib/notes/mutation-queue"
import { NotesService } from "@/lib/notes/notes-service"
import type { NotesRepository } from "@/lib/notes/notes-repository"
import { ensureWelcomeNotes } from "@/lib/notes/welcome-notes"
import type { SettingsRepository } from "@/lib/settings/settings-repository"

import { initialNotesState, notesReducer, type NotesState } from "./notes-reducer"

export interface NotesActions {
  createNote(input: NoteInput): Promise<Note>
  updateNote(id: string, patch: NoteUpdate): Promise<Note>
  deleteNote(id: string): Promise<void>
  togglePin(id: string): Promise<Note>
  reorderNotes(orderedIds: readonly string[]): Promise<Note[]>
  retryLoad(): Promise<void>
  clearMutationError(): void
}

const NotesStateContext = createContext<NotesState | null>(null)
const NotesActionsContext = createContext<NotesActions | null>(null)

export interface NotesProviderProps {
  repository: NotesRepository
  settingsRepository: SettingsRepository
  children: ReactNode
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

export function NotesProvider({
  repository,
  settingsRepository,
  children,
}: NotesProviderProps) {
  const [state, dispatch] = useReducer(notesReducer, initialNotesState)
  const [queue] = useState(createMutationQueue)
  const service = useMemo(() => new NotesService(repository), [repository])
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const runLoad = useCallback(async () => {
    dispatch({ type: "loadStarted" })

    try {
      // Seeding writes through the repository, so it joins the same
      // serialized queue as every other mutation.
      await queue.enqueue(() => ensureWelcomeNotes(service, settingsRepository))

      const notes = await service.getNotes()

      if (isMountedRef.current) {
        dispatch({ type: "loadSucceeded", notes })
      }
    } catch (error) {
      if (isMountedRef.current) {
        dispatch({ type: "loadFailed", error: toError(error) })
      }
    }
  }, [queue, service, settingsRepository])

  useEffect(() => {
    void runLoad()
  }, [runLoad])

  const runMutation = useCallback(
    async <T,>(task: () => Promise<T>): Promise<T> => {
      try {
        return await queue.enqueue(task)
      } catch (error) {
        dispatch({ type: "mutationFailed", error: toError(error) })

        throw error
      }
    },
    [queue],
  )

  const createNote = useCallback(
    (input: NoteInput) =>
      runMutation(async () => {
        const note = await service.createNote(input)
        dispatch({ type: "noteUpserted", note })

        return note
      }),
    [runMutation, service],
  )

  const updateNote = useCallback(
    (id: string, patch: NoteUpdate) =>
      runMutation(async () => {
        const note = await service.updateNote(id, patch)
        dispatch({ type: "noteUpserted", note })

        return note
      }),
    [runMutation, service],
  )

  const deleteNote = useCallback(
    (id: string) =>
      runMutation(async () => {
        await service.deleteNote(id)
        dispatch({ type: "noteDeleted", id })
      }),
    [runMutation, service],
  )

  const togglePin = useCallback(
    (id: string) =>
      runMutation(async () => {
        const note = await service.togglePin(id)
        dispatch({ type: "noteUpserted", note })

        return note
      }),
    [runMutation, service],
  )

  const reorderNotes = useCallback(
    (orderedIds: readonly string[]) =>
      runMutation(async () => {
        const notes = await service.reorderNotes(orderedIds)
        dispatch({ type: "notesReordered", notes })

        return notes
      }),
    [runMutation, service],
  )

  const retryLoad = useCallback(() => runLoad(), [runLoad])

  const clearMutationError = useCallback(() => {
    dispatch({ type: "mutationErrorCleared" })
  }, [])

  const actions = useMemo<NotesActions>(
    () => ({
      createNote,
      updateNote,
      deleteNote,
      togglePin,
      reorderNotes,
      retryLoad,
      clearMutationError,
    }),
    [
      createNote,
      updateNote,
      deleteNote,
      togglePin,
      reorderNotes,
      retryLoad,
      clearMutationError,
    ],
  )

  return (
    <NotesStateContext.Provider value={state}>
      <NotesActionsContext.Provider value={actions}>
        {children}
      </NotesActionsContext.Provider>
    </NotesStateContext.Provider>
  )
}

export function useNotesState(): NotesState {
  const context = useContext(NotesStateContext)

  if (context === null) {
    throw new Error("useNotesState must be used within a NotesProvider")
  }

  return context
}

export function useNotesActions(): NotesActions {
  const context = useContext(NotesActionsContext)

  if (context === null) {
    throw new Error("useNotesActions must be used within a NotesProvider")
  }

  return context
}