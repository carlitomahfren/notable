"use client"

import { Trash2 } from "lucide-react"

interface DeleteNoteButtonProps {
  onClick: () => void
}

/**
 * The one destructive action in the editor, as a single icon.
 *
 * It lives at the end of the editor's footer, below the content and away from the
 * title, so it cannot be hit by a stray tap while the note is being written and it
 * does not read as part of the note's own chrome. The icon is the affordance, which
 * means the name has to come from elsewhere: `aria-label` supplies it, and `title`
 * repeats it as a tooltip for anyone who does not reach for a screen reader.
 *
 * Deleting a note is not undoable from here, and the confirmation dialog still says
 * "Delete" in words. The icon alone never has to carry that.
 */
export function DeleteNoteButton({ onClick }: DeleteNoteButtonProps) {
  return (
    <button
      type="button"
      className="editor-delete"
      aria-label="Delete note"
      title="Delete note"
      onClick={onClick}
    >
      <Trash2 aria-hidden="true" className="editor-delete__icon" />
    </button>
  )
}