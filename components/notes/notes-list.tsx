"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"

import type { Note } from "@/types/note"
import { useNotesActions } from "@/components/providers/notes-provider"
import { useWorkspaceActions } from "@/components/providers/workspace-provider"
import { getDisplayTitle, sortNotes } from "@/lib/notes/selectors"
import { projectVisibleReorderToFull } from "@/lib/notes/reorder"

import { DeleteNoteDialog } from "./delete-note-dialog"
import { NOTE_DROP_ANIMATION } from "./drag-motion"
import { NoteCard } from "./note-card"
import { NotesEmptyState } from "./notes-empty-state"
import { SortableNoteCard } from "./sortable-note-card"
import {
  useNoteSelectionActions,
  useNoteSelectionState,
} from "./note-selection-provider"
import { resolveEmptyReason } from "./resolve-empty-reason"
import { useCreateNote } from "./use-create-note"
import { useDeleteNote, useReturnToList } from "./use-delete-note"
import { useNotesListView } from "./use-notes-list-view"
import { useSelectedNoteId } from "./use-selected-note-id"

/*
 * The stylesheet flattens every transition when reduced motion is asked for, but
 * the card's settle after a drop is a Web Animation and answers only to itself,
 * so the preference is read here for that one piece of movement.
 */
function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setPrefers(query.matches)

    sync()
    query.addEventListener("change", sync)

    return () => query.removeEventListener("change", sync)
  }, [])

  return prefers
}

export function NotesList() {
  const selectedNoteId = useSelectedNoteId()
  const { setSearchQuery } = useWorkspaceActions()
  const { togglePin, retryLoad, clearMutationError, reorderNotes } =
    useNotesActions()
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
  const [activeNote, setActiveNote] = useState<Note | null>(null)
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

  const noteById = useMemo(
    () => new Map(notes.map((note) => [note.id, note])),
    [notes],
  )

  /*
   * A note travels only among notes of its own region. Pinned notes sit above
   * unpinned ones and nothing may cross that line, so the drop target is chosen
   * from the dragged note's own region alone: pointing at the other region
   * lands at this region's edge, and the arrow keys stop at the same line. The
   * list is therefore never offered an order that would contradict the sort.
   */
  const detectCollision: CollisionDetection = useCallback(
    (args) => {
      const activeNote = noteById.get(String(args.active.id))

      if (activeNote === undefined) {
        return closestCenter(args)
      }

      const droppableContainers = args.droppableContainers.filter(
        (container) => {
          const note = noteById.get(String(container.id))

          return note !== undefined && note.isPinned === activeNote.isPinned
        },
      )

      return closestCenter({ ...args, droppableContainers })
    },
    [noteById],
  )

  // The list can only reorder notes it can see, so a drop produces a reorder of
  // the visible slice that is then projected back onto the full list.
  const fullOrder = useMemo(() => sortNotes(notes).map((note) => note.id), [notes])
  const visibleOrder = useMemo(
    () => visibleNotes.map((note) => note.id),
    [visibleNotes],
  )

  const sensors = useSensors(
    /*
     * A small threshold keeps a tap on the grip from becoming a drag the moment
     * a thumb lands; a real move crosses it almost immediately.
     */
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const prefersReducedMotion = usePrefersReducedMotion()
  const dropAnimation: DropAnimation = prefersReducedMotion
    ? { duration: 0 }
    : NOTE_DROP_ANIMATION

  const titleFor = useCallback(
    (id: string) => {
      const note = noteById.get(id)

      return note === undefined ? "A note" : getDisplayTitle(note)
    },
    [noteById],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveNote(
      noteById.get(String(event.active.id)) ?? null,
    )
  }, [noteById])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      const activeId = String(active.id)

      setActiveNote(null)

      if (over === null || activeId === String(over.id)) {
        return
      }

      const fromIndex = visibleOrder.indexOf(activeId)
      const toIndex = visibleOrder.indexOf(String(over.id))

      if (fromIndex === -1 || toIndex === -1) {
        return
      }

      const nextVisible = arrayMove(visibleOrder, fromIndex, toIndex)
      const nextFull = projectVisibleReorderToFull(
        fullOrder,
        nextVisible,
        activeId,
      )

      void reorderNotes(nextFull)
    },
    [fullOrder, reorderNotes, visibleOrder],
  )

  const handleDragCancel = useCallback(() => {
    setActiveNote(null)
  }, [])

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
        <DndContext
          sensors={sensors}
          collisionDetection={detectCollision}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          accessibility={{
            announcements: {
              onDragStart({ active }) {
                return `Picked up ${titleFor(String(active.id))}. Use the arrow keys to move it, space or enter to confirm, escape to cancel.`
              },
              onDragOver({ active, over }) {
                return over === null
                  ? `${titleFor(String(active.id))} is no longer over a note.`
                  : `${titleFor(String(active.id))} moved ${titleFor(String(over.id))}`
              },
              onDragEnd({ active, over }) {
                return over === null
                  ? `${titleFor(String(active.id))} dropped.`
                  : `${titleFor(String(active.id))} dropped ${titleFor(String(over.id))}`
              },
              onDragCancel({ active }) {
                return `${titleFor(String(active.id))} was dropped. Position unchanged.`
              },
            },
          }}
        >
          <SortableContext
            items={visibleOrder}
            strategy={verticalListSortingStrategy}
          >
            <ul className="note-list">
              {visibleNotes.map((note) => (
                <SortableNoteCard
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
          </SortableContext>

          <DragOverlay dropAnimation={dropAnimation}>
            {activeNote !== null && (
              <div className="note-card__overlay" role="group" aria-hidden="true">
                <NoteCard
                  note={activeNote}
                  isOpen={false}
                  isSelected={false}
                  dragOverlay
                  onSelect={() => {}}
                  onTogglePin={() => {}}
                  onDelete={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
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