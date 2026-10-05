"use client"

import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import { useNotesActions } from "@/components/providers/notes-provider"
import { useShell } from "@/components/shell/shell-provider"
import { NOTE_LIST_PATH } from "@/lib/notes/routes"

/**
 * Leaves the editor and returns to the list.
 *
 * No neighbouring note is selected on the way. Focus is requested rather than
 * applied directly: at narrow widths the list pane is hidden while the editor route
 * is still mounted, so an immediate `focus()` would target a `display: none` element
 * and be dropped.
 */
export function useReturnToList() {
  const router = useRouter()
  const { requestListFocus } = useShell()

  return useCallback(() => {
    router.push(NOTE_LIST_PATH)
    requestListFocus()
  }, [router, requestListFocus])
}

/**
 * The confirmation step of a delete: name the note, confirm, delete.
 *
 * The note under confirmation is held here rather than by the caller so that the
 * editor and a note card share one flow. Routing is deliberately left to the caller,
 * because the editor always leaves for the list while a card only does so when the
 * note it deleted is the open one.
 *
 * A rejected `confirmDelete` leaves the confirmation open, so the caller can report
 * the failure and try again rather than losing track of what was about to go.
 */
export function useDeleteNote() {
  const { deleteNote } = useNotesActions()
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null)

  const isConfirming = pendingNoteId !== null

  const requestDelete = useCallback((noteId: string) => {
    setPendingNoteId(noteId)
  }, [])

  const cancelDelete = useCallback(() => {
    setPendingNoteId(null)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (pendingNoteId === null) {
      return
    }

    await deleteNote(pendingNoteId)

    setPendingNoteId(null)
  }, [deleteNote, pendingNoteId])

  return {
    isConfirming,
    pendingNoteId,
    requestDelete,
    cancelDelete,
    confirmDelete,
  }
}