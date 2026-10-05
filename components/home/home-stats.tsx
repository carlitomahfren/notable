"use client"

import { useNotesState } from "@/components/providers/notes-provider"
import { getTagSummaries } from "@/lib/notes/selectors"

/**
 * Three numbers about the notebook, read straight from the notes state rather than
 * from a second copy of it. This page has no list to filter and no view to switch,
 * so it derives what it shows instead of reusing the workspace selectors, which
 * exist to answer "what should the list pane show right now".
 *
 * Counts are labelled rather than abbreviated: "1 note" tells you what the number
 * means, which "1" alone does not.
 */
export function HomeStats() {
  const { status, notes } = useNotesState()
  const isReady = status === "ready"

  const pinnedCount = notes.filter((note) => note.isPinned).length
  const tagCount = getTagSummaries(notes).length

  /*
   * The live region is a sibling of the list rather than a child of it. A `<dl>` may
   * only hold dt/dd groups, so a `<p>` inside one is a malformed definition list; and
   * a screen reader that met a bare ellipsis has nothing to read anyway.
   */
  return (
    <div className="home-stats" data-status={status}>
      <dl className="home-stats__list">
        <div className="home-stat">
          <dt className="home-stat__label">Notes</dt>
          <dd className="home-stat__value">{isReady ? notes.length : "…"}</dd>
        </div>

        <div className="home-stat">
          <dt className="home-stat__label">Pinned</dt>
          <dd className="home-stat__value">{isReady ? pinnedCount : "…"}</dd>
        </div>

        <div className="home-stat">
          <dt className="home-stat__label">Tags</dt>
          <dd className="home-stat__value">{isReady ? tagCount : "…"}</dd>
        </div>
      </dl>

      {/* The counts are decorative until the notes have loaded, and a screen reader
          meeting an ellipsis has nothing to read, so the state is spelled out. */}
      <p className="home-stats__state" aria-live="polite">
        {status === "loading" ? "Counting your notes." : null}
        {status === "error"
          ? "Your notes could not be read on this page. Open Notes to try again."
          : null}
      </p>
    </div>
  )
}