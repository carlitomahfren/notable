"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

import type { NoteCardProps } from "./note-card"
import { NoteCard } from "./note-card"
import { getDisplayTitle } from "@/lib/notes/selectors"

/**
 * The list row, wired for dragging.
 *
 * The `<li>` lives here rather than in the card so the transform and the
 * "being dragged" state can sit on the row itself. The grip keeps all pointer
 * and keyboard listeners, so nothing else on the row can start a drag; the
 * card's own link, tick, pin, and delete behave exactly as they did before.
 */
export function SortableNoteCard({ note, ...props }: NoteCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id })

  const handleLabel = `Reorder ${getDisplayTitle(note)}`

  return (
    <li
      ref={setNodeRef}
      className="note-card__item"
      data-selected={props.isSelected ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <NoteCard
        {...props}
        note={note}
        dragHandle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="note-card__drag"
            aria-label={handleLabel}
            title={handleLabel}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" className="note-card__drag-icon" />
          </button>
        }
      />
    </li>
  )
}