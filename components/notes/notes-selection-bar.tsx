"use client"

import { Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useNotesActions } from "@/components/providers/notes-provider"
import { useShell } from "@/components/shell/shell-provider"

import { DeleteNotesDialog } from "./delete-notes-dialog"
import {
  useNoteSelectionActions,
  useNoteSelectionState,
} from "./note-selection-provider"
import { useNotesListView } from "./use-notes-list-view"

/**
 * The list's selection row: tick everything visible, see what is ticked, clear it,
 * or delete it.
 *
 * It sits in the pane above the scrolling list rather than inside it, so the
 * destructive action stays reachable after a long scroll and never covers a note.
 *
 * The actions are contextual rather than permanently disabled. An inert Clear and an
 * inert Delete on every list is a row of weight the reader is not asking for, and the
 * only thing they can ever do at rest is refuse. They appear on the first tick, so the
 * row is a plain count until there is something to count.
 */
export function NotesSelectionBar() {
  const { status, visibleNotes } = useNotesListView()
  const { selectedNoteIds, selectedCount } = useNoteSelectionState()
  const { selectExactly, retainOnly, clearSelection } = useNoteSelectionActions()
  const { deleteNote } = useNotesActions()
  const { requestListFocus } = useShell()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)

  const visibleIds = useMemo(
    () => visibleNotes.map((note) => note.id),
    [visibleNotes],
  )

  const selectedVisibleCount = useMemo(
    () => visibleIds.filter((noteId) => selectedNoteIds.has(noteId)).length,
    [visibleIds, selectedNoteIds],
  )

  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length

  /*
   * A partially ticked list is neither of the two states a checkbox can show, so
   * the mixed state is set on the element rather than faked with a third glyph.
   */
  useEffect(() => {
    const selectAll = selectAllRef.current

    if (selectAll !== null) {
      selectAll.indeterminate =
        selectedVisibleCount > 0 && !allVisibleSelected
    }
  }, [selectedVisibleCount, allVisibleSelected])

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      clearSelection()

      return
    }

    selectExactly(visibleIds)
  }

  /*
   * Clear removes the button that was pressed, so focus would fall back to the
   * document and send the next Tab from the top of the page. The select all stays
   * mounted in both states, and it is the control that produced the selection, so it
   * is where a keyboard hand goes next.
   */
  const clearSelectionFromBar = () => {
    clearSelection()
    selectAllRef.current?.focus()
  }

  const confirmDeleteSelected = useCallback(async () => {
    const ids = [...selectedNoteIds]
    const deleted: string[] = []

    try {
      /*
       * One delete at a time, each awaited: every call joins the same serialized
       * mutation queue as a single delete, so a bulk delete cannot interleave with
       * an autosave or a pin.
       */
      for (const noteId of ids) {
        await deleteNote(noteId)
        deleted.push(noteId)
      }
    } catch (error) {
      // Whatever landed is gone, so the retry is described by what is left.
      retainOnly(ids.filter((noteId) => !deleted.includes(noteId)))

      throw error
    }

    clearSelection()
    setIsConfirmingDelete(false)
    requestListFocus()
  }, [clearSelection, deleteNote, requestListFocus, retainOnly, selectedNoteIds])

  const hasVisibleNotes = status === "ready" && visibleNotes.length > 0
  const hasSelection = selectedCount > 0

  return (
    <>
      {hasVisibleNotes ? (
        <div className="notes-selection">
          <label className="notes-selection__select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="notes-selection__checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
            />
            <span className="notes-selection__select-all-label">Select all</span>
          </label>

          {/*
            The count is the total selection rather than the part of it that happens
            to be on screen: it is the number the bulk delete will act on, and a
            filter can hide a tick without cancelling it. Where nothing is ticked it
            is a plain fact about the list, so it reads as a count of notes rather
            than as one about a selection.
          */}
          <p className="notes-selection__count" data-selected={hasSelection}>
            {hasSelection
              ? `${selectedCount} selected`
              : `${visibleNotes.length} ${visibleNotes.length === 1 ? "note" : "notes"}`}
          </p>

          {hasSelection ? (
            <div className="notes-selection__actions">
              <button
                type="button"
                className="notes-selection__button"
                onClick={clearSelectionFromBar}
              >
                Clear
              </button>

              <button
                type="button"
                className="notes-selection__button notes-selection__delete"
                onClick={() => setIsConfirmingDelete(true)}
              >
                <Trash2 aria-hidden="true" className="notes-selection__icon" />
                Delete selected
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isConfirmingDelete ? (
        <DeleteNotesDialog
          count={selectedCount}
          isOpen
          onCancel={() => setIsConfirmingDelete(false)}
          onConfirm={confirmDeleteSelected}
        />
      ) : null}
    </>
  )
}