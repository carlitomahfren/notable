"use client"

import { useMemo } from "react"

import { useNotesState } from "@/components/providers/notes-provider"
import { useWorkspaceState } from "@/components/providers/workspace-provider"
import { getTagSummaries, getVisibleNotes } from "@/lib/notes/selectors"

export function useNotesListView() {
  const { status, notes, loadError, mutationError } = useNotesState()
  const { view, searchQuery } = useWorkspaceState()

  const visibleNotes = useMemo(
    () => getVisibleNotes(notes, { filter: view, searchQuery }),
    [notes, view, searchQuery],
  )

  const tagSummaries = useMemo(() => getTagSummaries(notes), [notes])

  const pinnedCount = useMemo(
    () => notes.reduce((total, note) => (note.isPinned ? total + 1 : total), 0),
    [notes],
  )

  return {
    status,
    notes,
    visibleNotes,
    tagSummaries,
    view,
    searchQuery,
    loadError,
    mutationError,
    totalCount: notes.length,
    pinnedCount,
    hasSearchQuery: searchQuery.trim() !== "",
  }
}