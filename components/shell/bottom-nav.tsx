"use client"

import { Settings } from "lucide-react"

import { HomeNavLink } from "@/components/shell/home-nav-link"
import { PrimaryNav } from "@/components/shell/primary-nav"
import { TagsNav } from "@/components/shell/tags-nav"

interface BottomNavProps {
  onOpenPersonalize: () => void
}

/**
 * The mobile bar is the only navigation on a phone, so it carries every
 * destination. It stays in the CSS layer that hides it on wider screens, which
 * is why the same buttons are duplicated rather than repositioned at runtime.
 *
 * The desktop bar already owns the "Notes navigation" landmark. Only one of the two
 * is ever displayed, but both stay mounted so CSS alone can choose, and two
 * identically named navigation landmarks would be ambiguous if they ever were both
 * exposed. "Primary" is the usual name for a bottom tab bar and keeps the two
 * distinguishable.
 */
export function BottomNav({ onOpenPersonalize }: BottomNavProps) {
  return (
    <nav className="shell-bottom-nav" aria-label="Primary">
      <div className="shell-bottom-nav__slot">
        <HomeNavLink />
      </div>

      <PrimaryNav placement="bottom" />
      <TagsNav placement="bottom" />
      <div className="shell-bottom-nav__slot">
        <button type="button" className="shell-nav-button" onClick={onOpenPersonalize}>
          <Settings aria-hidden="true" className="shell-nav-button__icon" />
          <span className="shell-nav-button__label">Settings</span>
        </button>
      </div>
    </nav>
  )
}