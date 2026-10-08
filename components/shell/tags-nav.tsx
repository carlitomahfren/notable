"use client"

import { Hash } from "lucide-react"

import { useWorkspaceState } from "@/components/providers/workspace-provider"
import { isViewActive } from "@/components/shell/view-active"
import { useWorkspaceDestination } from "@/components/shell/use-workspace-destination"

type TagsPlacement = "topbar" | "bottom"

/**
 * Tags is a workspace, not a hidden list: the trigger opens the Tags view in the
 * same single step as All Notes opens its own, and the view change goes through
 * the workspace state like every other destination. A tag filter picked inside
 * that view keeps the trigger marked as current, which is what the header is
 * for — it names the workspace, and the header's own filter narrows it.
 *
 * Like every other destination, it also has to reach a list that is actually on
 * screen: where the stylesheet has taken the list away, the choice rides to the
 * workspace by route instead of ending at the active state.
 */
export function TagsNav({ placement }: { placement: TagsPlacement }) {
  const { view } = useWorkspaceState()
  const chooseDestination = useWorkspaceDestination()

  const isActive = isViewActive(view, { kind: "tags" })

  return (
    <div className="shell-tags" data-placement={placement}>
      <button
        type="button"
        className="shell-tags__trigger"
        aria-current={isActive ? "true" : undefined}
        onClick={() => {
          chooseDestination({ kind: "tags" })
        }}
      >
        <Hash aria-hidden="true" className="shell-tags__icon" />
        <span className="shell-tags__label">Tags</span>
      </button>
    </div>
  )
}