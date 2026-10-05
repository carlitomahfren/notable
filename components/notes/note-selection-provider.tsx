"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export interface NoteSelectionState {
  /** Note ids currently selected. Ephemeral: never stored, never written back. */
  selectedNoteIds: ReadonlySet<string>
  selectedCount: number
  isSelectionActive: boolean
}

export interface NoteSelectionActions {
  toggleNote: (noteId: string) => void
  /** Replaces the selection with exactly these ids, which is what "select all" means. */
  selectExactly: (noteIds: readonly string[]) => void
  /** Keeps only these ids. Used when notes leave the store underneath the selection. */
  retainOnly: (noteIds: readonly string[]) => void
  clearSelection: () => void
}

const NoteSelectionStateContext = createContext<NoteSelectionState | null>(null)
const NoteSelectionActionsContext = createContext<NoteSelectionActions | null>(
  null,
)

/**
 * Which notes the reader has ticked, for as long as they stay on screen.
 *
 * A selection is a gesture, not a property of a note: nothing here reaches the
 * domain, the repository, or storage. It lives beside the list because the list is
 * the only place that both offers the tick and performs the action it leads to.
 */
export function NoteSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedNoteIds, setSelectedNoteIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )

  const toggleNote = useCallback((noteId: string) => {
    setSelectedNoteIds((current) => {
      const next = new Set(current)

      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }

      return next
    })
  }, [])

  const selectExactly = useCallback((noteIds: readonly string[]) => {
    setSelectedNoteIds(new Set(noteIds))
  }, [])

  /*
   * An intersection, not a replacement: the list tells the selection which notes
   * still exist, and a tick made before a filter changed is still a tick.
   */
  const retainOnly = useCallback((noteIds: readonly string[]) => {
    const allowed = new Set(noteIds)

    setSelectedNoteIds((current) => {
      const kept = new Set(
        [...current].filter((noteId) => allowed.has(noteId)),
      )

      if (kept.size === current.size) {
        return current
      }

      return kept
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedNoteIds(new Set<string>())
  }, [])

  const state = useMemo<NoteSelectionState>(
    () => ({
      selectedNoteIds,
      selectedCount: selectedNoteIds.size,
      isSelectionActive: selectedNoteIds.size > 0,
    }),
    [selectedNoteIds],
  )

  const actions = useMemo<NoteSelectionActions>(
    () => ({ toggleNote, selectExactly, retainOnly, clearSelection }),
    [toggleNote, selectExactly, retainOnly, clearSelection],
  )

  return (
    <NoteSelectionStateContext.Provider value={state}>
      <NoteSelectionActionsContext.Provider value={actions}>
        {children}
      </NoteSelectionActionsContext.Provider>
    </NoteSelectionStateContext.Provider>
  )
}

export function useNoteSelectionState(): NoteSelectionState {
  const context = useContext(NoteSelectionStateContext)

  if (context === null) {
    throw new Error(
      "useNoteSelectionState must be used within a NoteSelectionProvider",
    )
  }

  return context
}

export function useNoteSelectionActions(): NoteSelectionActions {
  const context = useContext(NoteSelectionActionsContext)

  if (context === null) {
    throw new Error(
      "useNoteSelectionActions must be used within a NoteSelectionProvider",
    )
  }

  return context
}