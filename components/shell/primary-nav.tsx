"use client"

import { useWorkspaceActions, useWorkspaceState } from "@/components/providers/workspace-provider"
import { VIEW_NAV_ITEMS } from "@/components/shell/nav-items"
import { isViewActive } from "@/components/shell/view-active"

/**
 * All Notes and Pinned share one implementation so the desktop bar and the
 * mobile bar can never disagree about the current destination.
 */
export function PrimaryNav({ placement }: { placement: "topbar" | "bottom" }) {
  const { view } = useWorkspaceState()
  const { setView } = useWorkspaceActions()

  return (
    <ul className="shell-primary-nav" data-placement={placement}>
      {VIEW_NAV_ITEMS.map((item) => {
        const { Icon, key, label, view: itemView } = item
        const isActive = isViewActive(view, itemView)

        return (
          <li key={key}>
            <button
              type="button"
              className="shell-nav-button"
              aria-current={isActive ? "true" : undefined}
              onClick={() => {
                setView(itemView)
              }}
            >
              <Icon aria-hidden="true" className="shell-nav-button__icon" />
              <span className="shell-nav-button__label">{label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}