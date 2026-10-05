"use client"

import { useCallback, useEffect } from "react"

import { DeleteNoteButton } from "@/components/editor/delete-note-button"
import { NoteEditor } from "@/components/editor/note-editor"
import { DeleteNoteDialog } from "@/components/notes/delete-note-dialog"
import {
  useDeleteNote,
  useReturnToList,
} from "@/components/notes/use-delete-note"
import { useNotesState } from "@/components/providers/notes-provider"
import { useShell } from "@/components/shell/shell-provider"

export function NoteDetailView({ noteId }: { noteId: string }) {
  const { status, loadError, notes } = useNotesState()
  const { consumeTitleFocus, focusTitle } = useShell()
  const { isConfirming, requestDelete, cancelDelete, confirmDelete } =
    useDeleteNote()
  const returnToList = useReturnToList()
  const note = notes.find((candidate) => candidate.id === noteId)

  useEffect(() => {
    if (consumeTitleFocus()) {
      focusTitle()
    }
  }, [noteId, consumeTitleFocus, focusTitle])

  const confirmDeleteAndReturn = useCallback(async () => {
    await confirmDelete()
    returnToList()
  }, [confirmDelete, returnToList])

  /*
   * There is no link back to the list from here. On a phone the bottom bar is the
   * navigation, and once both panes fit the list is already on screen beside this
   * one, so a second way back would be a duplicate of wherever the reader already is.
   */
  return (
    <div className="shell-editor">
      {status === "loading" && (
        <p className="shell-placeholder" role="status">
          Loading note…
        </p>
      )}

      {status === "error" && (
        <p className="shell-placeholder" role="alert">
          {loadError?.message ?? "Notes could not be loaded."}
        </p>
      )}

      {status === "ready" && note === undefined && (
        <div className="shell-editor shell-editor--empty">
          <h1 className="shell-editor__title">Note not found</h1>
          <p className="shell-placeholder">
            This note is no longer stored on this device.
          </p>
        </div>
      )}

      {status === "ready" && note !== undefined && (
        <>
          {/* Keying by id gives every note its own draft, so a draft can
              never appear under a different note. */}
          <NoteEditor
            key={note.id}
            note={note}
            autosaveAbandoned={isConfirming}
            deleteControl={
              <DeleteNoteButton onClick={() => requestDelete(note.id)} />
            }
          />

          <DeleteNoteDialog
            note={note}
            isOpen={isConfirming}
            onCancel={cancelDelete}
            onConfirm={confirmDeleteAndReturn}
          />
        </>
      )}
    </div>
  )
}