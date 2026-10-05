import type { WorkspaceView } from "@/components/providers/workspace-provider"

export type NotesListEmptyReason =
  | "no-notes"
  | "no-pinned"
  | "no-tagged-notes"
  | "no-search-results"

export interface NotesEmptyStateProps {
  reason: NotesListEmptyReason
  searchQuery?: string
  view?: WorkspaceView
  onCreateNote: () => void
  onClearSearch?: () => void
}

interface EmptyStateContent {
  title: string
  description: string
}

function getContent(
  reason: NotesListEmptyReason,
  searchQuery: string,
  view: WorkspaceView | undefined,
): EmptyStateContent {
  if (reason === "no-search-results") {
    return {
      title: "No notes found.",
      description:
        searchQuery.trim() === ""
          ? "Try another search term."
          : `No notes match “${searchQuery.trim()}”. Try another search term.`,
    }
  }

  if (reason === "no-pinned") {
    return {
      title: "Nothing pinned yet.",
      description: "Pin important notes to keep them here.",
    }
  }

  if (reason === "no-tagged-notes") {
    const tag = view?.kind === "tag" ? view.tag : ""

    return {
      title: `No notes tagged #${tag}.`,
      description: "Notes with this tag will appear here.",
    }
  }

  return {
    title: "No notes yet.",
    description:
      "Create your first note and start building your personal workspace.",
  }
}

export function NotesEmptyState({
  reason,
  searchQuery = "",
  view,
  onCreateNote,
  onClearSearch,
}: NotesEmptyStateProps) {
  const { title, description } = getContent(reason, searchQuery, view)

  return (
    <div className="notes-empty">
      <p className="notes-empty__title">{title}</p>
      <p className="notes-empty__description">{description}</p>

      <div className="notes-empty__actions">
        {reason === "no-search-results" ? (
          onClearSearch !== undefined && (
            <button type="button" onClick={onClearSearch}>
              Clear search
            </button>
          )
        ) : (
          <button type="button" onClick={onCreateNote}>
            Create note
          </button>
        )}
      </div>
    </div>
  )
}