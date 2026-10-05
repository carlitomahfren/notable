"use client"

import { ConfirmDialog } from "./confirm-dialog"

interface DeleteNotesDialogProps {
  count: number
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}

/**
 * Confirmation for a bulk delete. It states how many notes are about to go, because
 * "Delete" on its own would leave the reader guessing whether one card or the whole
 * selection is at stake.
 */
export function DeleteNotesDialog({
  count,
  isOpen,
  onCancel,
  onConfirm,
}: DeleteNotesDialogProps) {
  const noun = count === 1 ? "note" : "notes"

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={`Delete ${count} ${noun}?`}
      description={`${count} selected ${noun} will be permanently removed from this device.`}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}