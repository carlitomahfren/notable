"use client"

import { Hash } from "lucide-react"

import { useWorkspaceActions, useWorkspaceState } from "@/components/providers/workspace-provider"

import { useNotesListView } from "./use-notes-list-view"

/**
 * The name of the workspace the list is currently showing, when the list is not
 * simply every note.
 *
 * A tag used to be a filter you could not see: the disclosure closed, the list got
 * shorter, and nothing said why or how to get back. This names the collection, counts
 * what is in it, and leaves one control to step out of it, which is what makes the
 * tag view a destination rather than a side effect.
 *
 * All Notes and Pinned need no heading: their own navigation entry is already on
 * screen and already marked as the current destination.
 */
export function NotesWorkspaceHeader({
  headingLevel = 2,
}: {
  /*
   * The open note is the page's own h1, so a heading inside the list has to sit
   * under it. When the list is standing alone there is no h1 above it, and a
   * heading that skipped a level is the worse of the two mistakes: this is the
   * view, so this is the heading that names it.
   */
  headingLevel?: 1 | 2
}) {
  const { view } = useWorkspaceState()
  const { setView } = useWorkspaceActions()
  const { visibleNotes, tagSummaries, hasSearchQuery } = useNotesListView()

  if (view.kind !== "tag") {
    return null
  }

  const tag = view.tag
  const totalInTag =
    tagSummaries.find((summary) => summary.tag === tag)?.count ?? visibleNotes.length
  const visible = visibleNotes.length

  /*
   * A search inside the tag view is reported as a share of the tag rather than as a
   * bare total, because the two numbers stop being the same thing the moment a query
   * is typed and "2 notes" alone would hide that.
   */
  const countLabel = hasSearchQuery
    ? `${visible} of ${totalInTag} notes`
    : `${totalInTag} ${totalInTag === 1 ? "note" : "notes"}`

  const Heading = headingLevel === 1 ? "h1" : "h2"

  return (
    <header className="notes-workspace">
      <div className="notes-workspace__identity">
        <Hash aria-hidden="true" className="notes-workspace__icon" />

        <Heading className="notes-workspace__name">{tag}</Heading>

        <p className="notes-workspace__count">{countLabel}</p>
      </div>

      <button
        type="button"
        className="notes-workspace__exit"
        onClick={() => {
          setView({ kind: "all" })
        }}
      >
        Show all notes
      </button>
    </header>
  )
}