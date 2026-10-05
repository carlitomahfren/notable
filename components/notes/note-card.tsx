import Link from "next/link"
import { Pin, PinOff, Trash2 } from "lucide-react"

import type { Note } from "@/types/note"
import {
  getDisplayTitle,
  getNoteExcerpt,
} from "@/lib/notes/selectors"
import {
  formatNoteTimestamp,
  formatNoteTimestampLong,
} from "@/lib/utils/format-note-timestamp"

export interface NoteCardProps {
  note: Note
  /** The note in the URL, marked as the current page. */
  isOpen: boolean
  /** Ticked for selection. Carries no meaning beyond this screen. */
  isSelected: boolean
  isBusy?: boolean
  onSelect: (id: string) => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
}

/**
 * One note in the list: open it, pin it, tick it, or delete it.
 *
 * The card is a link, so the tick and the two actions are siblings of it rather than
 * descendants. A control nested inside the link would be activated by a click meant
 * for it, which is how a delete turns into an open.
 */
export function NoteCard({
  note,
  isOpen,
  isSelected,
  isBusy = false,
  onSelect,
  onTogglePin,
  onDelete,
}: NoteCardProps) {
  const excerpt = getNoteExcerpt(note)
  const title = getDisplayTitle(note)
  const updatedLabel = formatNoteTimestamp(note.updatedAt)
  const updatedDetail = formatNoteTimestampLong(note.updatedAt)
  const selectLabel = isSelected ? `Deselect ${title}` : `Select ${title}`
  const deleteLabel = `Delete ${title}`

  return (
    <li className="note-card__item" data-selected={isSelected ? "true" : "false"}>
      {/*
        The tick is a real checkbox rather than a styled icon, so it is reachable by
        keyboard and announced as a control with a state. The label is the target, so
        the box can stay small while the thing a thumb aims at does not.
      */}
      <label className="note-card__select">
        <input
          type="checkbox"
          className="note-card__select-input"
          checked={isSelected}
          onChange={() => onSelect(note.id)}
        />
        <span className="visually-hidden">{selectLabel}</span>
      </label>

      <Link
        href={`/notes/${note.id}`}
        className="note-card"
        aria-current={isOpen ? "page" : undefined}
      >
        <span className="note-card__header">
          {/*
            The title is visually truncated with an ellipsis, so the full string
            is repeated here. Without it a long title is unreadable at narrow
            widths and at high zoom.
          */}
          <span className="note-card__title" title={title}>
            {title}
          </span>

          {note.isPinned && (
            <span className="note-card__pinned">
              <Pin aria-hidden="true" className="note-card__pinned-icon" />
              <span className="visually-hidden">Pinned</span>
            </span>
          )}
        </span>

        {excerpt !== "" && (
          <span className="note-card__excerpt">{excerpt}</span>
        )}

        <span className="note-card__meta">
          <time dateTime={note.updatedAt} title={updatedDetail}>
            {updatedLabel}
          </time>

          {note.tags.length > 0 && (
            <span className="note-card__tags">
              {note.tags.map((tag) => (
                <span key={tag} className="note-card__tag">
                  #{tag}
                </span>
              ))}
            </span>
          )}
        </span>
      </Link>

      {/*
        Stacked in one column rather than set in a row across the card: two 44px
        targets side by side would take a third of a 20rem list pane, which is the
        width a title has to be read in.
      */}
      <span className="note-card__actions">
        <button
          type="button"
          className="note-card__pin"
          onClick={() => onTogglePin(note.id)}
          disabled={isBusy}
          /*
           * The accessible name states the action and the icon changes with the
           * state, so `aria-pressed` would only contradict it: a screen reader
           * would announce "Unpin Alpha, toggle button, pressed". The state is
           * already carried by the label text and by the filled icon.
           */
          aria-label={note.isPinned ? `Unpin ${title}` : `Pin ${title}`}
          title={note.isPinned ? `Unpin ${title}` : `Pin ${title}`}
        >
          <span aria-hidden="true">
            {note.isPinned ? (
              <Pin className="note-card__pin-icon" />
            ) : (
              <PinOff className="note-card__pin-icon" />
            )}
          </span>
        </button>

        {/*
          Deleting from the card asks the same question the editor asks and removes
          the same way. It is an icon, so the name comes from the label, and the
          dialog is where the consequence is spelled out.
        */}
        <button
          type="button"
          className="note-card__delete"
          onClick={() => onDelete(note.id)}
          disabled={isBusy}
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <Trash2 aria-hidden="true" className="note-card__delete-icon" />
        </button>
      </span>
    </li>
  )
}