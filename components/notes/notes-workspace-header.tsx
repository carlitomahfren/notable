"use client"

import { useId } from "react"
import { Hash } from "lucide-react"

import { useWorkspaceActions, useWorkspaceState } from "@/components/providers/workspace-provider"

import { useNotesListView } from "./use-notes-list-view"

/**
 * The name of the workspace the list is currently showing, when the list is not
 * simply every note.
 *
 * Tags is now a real workspace: the navigation entry opens the Tags view, and
 * this header names it, counts what is in it, and narrows it with a tag filter.
 * The filter is a native select rather than another menu, so it is a single tab
 * stop whose options come from the platform's own menu, and its first option is
 * All Tags itself — every state the workspace can be in is reachable from here
 * without leaving it.
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
  const { visibleNotes, totalCount, tagSummaries, hasSearchQuery } =
    useNotesListView()
  const filterId = useId()

  if (view.kind !== "tags" && view.kind !== "tag") {
    return null
  }

  const isAllTags = view.kind === "tags"
  const totalInView = isAllTags
    ? totalCount
    : tagSummaries.find((summary) => summary.tag === view.tag)?.count ??
      visibleNotes.length
  const visible = visibleNotes.length

  /*
   * A search inside the workspace is reported as a share of what is in it rather
   * than as a bare total, because the two numbers stop being the same thing the
   * moment a query is typed and "2 notes" alone would hide that.
   */
  const countLabel = hasSearchQuery
    ? `${visible} of ${totalInView} notes`
    : `${totalInView} ${totalInView === 1 ? "note" : "notes"}`

  const options = tagSummaries.map((summary) => summary.tag)

  /*
   * A tag whose last note was deleted is no longer in the summaries, but the
   * filter must keep showing it: the view is still that tag, and a fine drop to
   * All Tags would change the workspace behind the user's back.
   */
  if (view.kind === "tag" && !options.includes(view.tag)) {
    options.unshift(view.tag)
  }

  const Heading = headingLevel === 1 ? "h1" : "h2"

  return (
    <header className="notes-workspace">
      <div className="notes-workspace__identity">
        <Hash aria-hidden="true" className="notes-workspace__icon" />

        <Heading className="notes-workspace__name">Tags</Heading>

        <p className="notes-workspace__count">{countLabel}</p>
      </div>

      <label className="visually-hidden" htmlFor={filterId}>
        Filter notes by tag
      </label>

      <select
        id={filterId}
        className="notes-workspace__filter"
        value={isAllTags ? "" : view.tag}
        onChange={(event) => {
          const tag = event.target.value
          setView(tag === "" ? { kind: "tags" } : { kind: "tag", tag })
        }}
      >
        <option value="">All Tags</option>
        {options.map((tag) => (
          <option key={tag} value={tag}>
            #{tag}
          </option>
        ))}
      </select>
    </header>
  )
}