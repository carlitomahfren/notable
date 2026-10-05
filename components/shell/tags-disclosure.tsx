"use client"

import { useEffect, useId, useRef } from "react"
import { Hash } from "lucide-react"

import { useWorkspaceActions, useWorkspaceState } from "@/components/providers/workspace-provider"
import { useNotesListView } from "@/components/notes/use-notes-list-view"
import { useShell } from "@/components/shell/shell-provider"
import { isViewActive } from "@/components/shell/view-active"

type TagsPlacement = "topbar" | "bottom"

/**
 * Tags are a navigation filter, not a page, so they open as a disclosure instead
 * of pushing another route. The selection still goes through the workspace view,
 * which means the list, the empty state, and deep links keep working unchanged.
 */
export function TagsDisclosure({ placement }: { placement: TagsPlacement }) {
  const { view } = useWorkspaceState()
  const { setView } = useWorkspaceActions()
  const { tagSummaries } = useNotesListView()
  const { isTagsOpen, toggleTags, closeTags } = useShell()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const isTagViewActive = view.kind === "tag"

  useEffect(() => {
    if (!isTagsOpen) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target

      /*
       * Both bars keep a copy of this disclosure mounted, so "inside" has to mean
       * inside any of them. Checking only this instance would let whichever copy
       * is not on screen dismiss the panel the moment the pointer touches the one
       * that is.
       */
      if (target instanceof Element && target.closest("[data-shell-tags]") !== null) {
        return
      }

      closeTags()
    }

    document.addEventListener("mousedown", onPointerDown)

    return () => {
      document.removeEventListener("mousedown", onPointerDown)
    }
  }, [closeTags, isTagsOpen])

  return (
    <div
      className="shell-tags"
      data-shell-tags=""
      data-placement={placement}
      /*
       * Escape is handled on the trigger and panel only, never on the document.
       * Both bars keep a copy of this disclosure mounted, so a document-level
       * listener would let whichever instance registered last steal focus back to
       * a control the user cannot see.
       */
      onKeyDown={(event) => {
        if (event.key !== "Escape") {
          return
        }

        event.preventDefault()
        closeTags()
        triggerRef.current?.focus()
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="shell-tags__trigger"
        aria-expanded={isTagsOpen}
        aria-controls={panelId}
        aria-current={isTagViewActive ? "true" : undefined}
        onClick={toggleTags}
      >
        <Hash aria-hidden="true" className="shell-tags__icon" />
        <span className="shell-tags__label">Tags</span>
      </button>

      <div id={panelId} className="shell-tags__panel" hidden={!isTagsOpen}>
        {tagSummaries.length === 0 ? (
          <p className="shell-tags__empty">No tags yet</p>
        ) : (
          <ul className="shell-tags__list">
            {tagSummaries.map((summary) => {
              const tagView = { kind: "tag" as const, tag: summary.tag }

              return (
                <li key={summary.tag}>
                  <button
                    type="button"
                    className="shell-tags__option"
                    aria-current={isViewActive(view, tagView) ? "true" : undefined}
                    onClick={() => {
                      setView(tagView)
                      closeTags()
                    }}
                  >
                    <span className="shell-tags__name">{summary.tag}</span>
                    <span className="shell-tags__count" aria-hidden="true">
                      {summary.count}
                    </span>
                    <span className="visually-hidden">
                      {`, ${summary.count} ${summary.count === 1 ? "note" : "notes"}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}