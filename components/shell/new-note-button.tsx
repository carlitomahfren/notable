"use client"

import { SquarePen } from "lucide-react"

import { useCreateNote } from "@/components/notes/use-create-note"

interface NewNoteButtonProps {
  /** `bar` sits in the top utilities, `fab` floats above the mobile bar. */
  variant?: "bar" | "fab"
}

export function NewNoteButton({ variant = "bar" }: NewNoteButtonProps) {
  const { createEmptyNote, isCreating } = useCreateNote()

  return (
    <button
      type="button"
      className="shell-new-note"
      data-variant={variant}
      onClick={() => void createEmptyNote()}
      disabled={isCreating}
    >
      <SquarePen aria-hidden="true" className="shell-new-note__icon" />
      <span className="shell-new-note__label">New note</span>
    </button>
  )
}