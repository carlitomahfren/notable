"use client"

import { useCallback, useEffect, useState } from "react"

import { useNotesActions } from "@/components/providers/notes-provider"
import { useWorkspaceActions } from "@/components/providers/workspace-provider"

import { DeleteNoteDialog } from "./delete-note-dialog"
import { NoteCard } from "./note-card"
import { NotesEmptyState } from "./notes-empty-state"
import {
  useNoteSelectionActions,
  useNoteSelectionState,
} from "./note-selection-provider"
import { resolveEmptyReason } from "./resolve-empty-reason"
import { useCreateNote } from "./use-create-note"
import { useDeleteNote, useReturnToList } from "./use-delete-note"
import { useNotesListView } from "./use-notes-list-view"
import { useSelectedNoteId } from "./use-selected-note-id"

export function NotesList() {
  const selectedNoteId = useSelectedNoteId()
  const { setSearchQuery } = useWorkspaceActions()
  const { togglePin, retryLoad, clearMutationError } = useNotesActions()
  const { createEmptyNote } = useCreateNote()
  const returnToList = useReturnToList()
  const { selectedNoteIds } = useNoteSelectionState()
  const { toggleNote, retainOnly } = useNoteSelectionActions()
  const {
    status,
    notes,
    visibleNotes,
    view,
    searchQuery,
    loadError,
    mutationError,
    totalCount,
    hasSearchQuery,
  } = useNotesListView()
  const [pendingPinId, setPendingPinId] = useState<string | null>(null)
  const { pendingNoteId, requestDelete, cancelDelete, confirmDelete } =
    useDeleteNote()
  const pendingNote = notes.find((note) => note.id === pendingNoteId)

  /*
   * A selection outlives the filters it was made in, but not the notes: if one of
   * them is deleted from anywhere else, ticking it again would promise a deletion
   * that can no longer happen, and the count would be wrong until the screen is
   * reloaded.
   */
  useEffect(() => {
    retainOnly(notes.map((note) => note.id))
  }, [notes, retainOnly])

  const handleTogglePin = useCallback(
    async (id: string) => {
      setPendingPinId(id)

      try {
        await togglePin(id)
      } catch {
        // The mutation error is surfaced by provider state.
      } finally {
        setPendingPinId(null)
      }
    },
    [togglePin],
  )

  const handleDeleteNote = useCallback(
    async () => {
      if (pendingNoteId === null) {
        return
      }

      const deletedNoteId = pendingNoteId

      await confirmDelete()

      /*
       * Deleting the open note from the list leaves the editor pointing at a note
       * that is gone, so the route returns to the list exactly as it does from the
       * editor itself. Any other note is a list edit and the route stays put.
       */
      if (deletedNoteId === selectedNoteId) {
        returnToList()
      }
    },
    [confirmDelete, returnToList, selectedNoteId, pendingNoteId],
  )

  if (status === "loading") {
    return (
      <p className="shell-placeholder" role="status">
        Loading notes…
      </p>
    )
  }

  if (status === "error") {
    return (
      <div className="notes-error" role="alert">
        <p>{loadError?.message ?? "Notes could not be loaded."}</p>
        <button type="button" onClick={() => void retryLoad()}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <>
      {mutationError !== null && (
        <div className="notes-error" role="alert">
          <p>{mutationError.message}</p>
          <button type="button" onClick={clearMutationError}>
            Dismiss
          </button>
        </div>
      )}

      {visibleNotes.length === 0 ? (
        <NotesEmptyState
          reason={resolveEmptyReason({ totalCount, hasSearchQuery, view })}
          searchQuery={searchQuery}
          view={view}
          onCreateNote={() => void createEmptyNote()}
          onClearSearch={() => setSearchQuery("")}
        />
      ) : (
        <ul className="note-list">
          {visibleNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isOpen={note.id === selectedNoteId}
              isSelected={selectedNoteIds.has(note.id)}
              isBusy={pendingPinId === note.id || pendingNoteId === note.id}
              onSelect={toggleNote}
              onTogglePin={(id) => void handleTogglePin(id)}
              onDelete={requestDelete}
            />
          ))}
        </ul>
      )}

      {pendingNote !== undefined ? (
        <DeleteNoteDialog
          note={pendingNote}
          isOpen={pendingNoteId !== null}
          onCancel={cancelDelete}
          onConfirm={handleDeleteNote}
        />
      ) : null}
    </>
  )
}