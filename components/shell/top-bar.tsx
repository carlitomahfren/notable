"use client"

import { useWorkspaceActions, useWorkspaceState } from "@/components/providers/workspace-provider"
import { useNotesListView } from "@/components/notes/use-notes-list-view"
import { ExpandableSearch } from "@/components/shell/expandable-search"
import { HomeNavLink } from "@/components/shell/home-nav-link"
import { PrimaryNav } from "@/components/shell/primary-nav"
import { TagsDisclosure } from "@/components/shell/tags-disclosure"
import { ThemeQuickToggle } from "@/components/shell/theme-quick-toggle"
import { NewNoteButton } from "@/components/shell/new-note-button"
import { Settings } from "lucide-react"

interface TopBarProps {
  onOpenPersonalize: () => void
}

export function TopBar({ onOpenPersonalize }: TopBarProps) {
  const { searchQuery } = useWorkspaceState()
  const { setSearchQuery } = useWorkspaceActions()
  const { visibleNotes } = useNotesListView()

  return (
    <header className="shell-top-bar">
      <div className="shell-top-bar__brand">
        <span className="shell-top-bar__name">Notable</span>
      </div>

      <nav className="shell-top-bar__nav" aria-label="Notes navigation">
        <div className="shell-top-bar__home">
          <HomeNavLink />
        </div>

        <PrimaryNav placement="topbar" />
        <TagsDisclosure placement="topbar" />
      </nav>

      <div className="shell-top-bar__utilities">
        <ExpandableSearch
          value={searchQuery}
          onChange={setSearchQuery}
          resultCount={visibleNotes.length}
        />

        <NewNoteButton />
        <ThemeQuickToggle />

        <button
          type="button"
          className="shell-icon-button shell-settings-button"
          aria-label="Settings"
          onClick={onOpenPersonalize}
        >
          <Settings aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}