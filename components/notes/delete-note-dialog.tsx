"use client"

import { getDisplayTitle } from "@/lib/notes/selectors"
import type { Note } from "@/types/note"

import { ConfirmDialog } from "./confirm-dialog"

interface DeleteNoteDialogProps {
  note: Note
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}

/**
 * Confirmation for deleting one note, named in the question and the consequence so
 * the destructive button never has to carry that on its own.
 */
export function DeleteNoteDialog({
  note,
  isOpen,
  onCancel,
  onConfirm,
}: DeleteNoteDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Delete note?"
      description={`“${getDisplayTitle(note)}” will be permanently removed from this device.`}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}