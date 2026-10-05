import type { WorkspaceView } from "@/components/providers/workspace-provider"
import type { NotesListEmptyReason } from "@/components/notes/notes-empty-state"

export interface EmptyReasonInput {
  totalCount: number
  hasSearchQuery: boolean
  view: WorkspaceView
}

/**
 * Decides which empty state to show. Search takes precedence over the
 * active view, because "no matches for your search" is the actionable
 * message even inside Pinned or a tag.
 */
export function resolveEmptyReason({
  totalCount,
  hasSearchQuery,
  view,
}: EmptyReasonInput): NotesListEmptyReason {
  if (totalCount === 0) {
    return "no-notes"
  }

  if (hasSearchQuery) {
    return "no-search-results"
  }

  if (view.kind === "pinned") {
    return "no-pinned"
  }

  return "no-tagged-notes"
}