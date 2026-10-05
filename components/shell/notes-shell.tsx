"use client"

import { useEffect, useState, type ReactNode } from "react"

import { NotesList } from "@/components/notes/notes-list"
import { NoteSelectionProvider } from "@/components/notes/note-selection-provider"
import { NotesSelectionBar } from "@/components/notes/notes-selection-bar"
import { NotesWorkspaceHeader } from "@/components/notes/notes-workspace-header"
import { PersonalizeDialog } from "@/components/theme/personalize-dialog"

import { BottomNav } from "./bottom-nav"
import { NewNoteButton } from "./new-note-button"
import { TopBar } from "./top-bar"
import { useShell } from "./shell-provider"

export function NotesShell({ children }: { children: ReactNode }) {
  const { isEditorScreen, setListRef, requestListFocus, consumeListFocus, focusList } =
    useShell()
  const [isPersonalizeOpen, setIsPersonalizeOpen] = useState(false)

  /**
   * A focus request cannot be satisfied by the caller: after deleting a note the
   * route has not changed yet, so the list pane is still `display: none` and a
   * synchronous `focus()` would be silently dropped. The request is therefore
   * parked in shell state and honoured here, once React has committed the pane.
   */
  useEffect(() => {
    if (consumeListFocus()) {
      focusList()
    }
  }, [consumeListFocus, focusList, isEditorScreen])

  /**
   * Personalize is opened straight from the settings entry instead of behind a
   * larger settings screen: it is the only setting surface in the app, so a
   * wrapper screen would add a step without adding a capability.
   */
  const closePersonalize = () => {
    setIsPersonalizeOpen(false)
    requestListFocus()
  }

  return (
    <div className="shell" data-editor-open={isEditorScreen ? "true" : "false"}>
      <a className="shell-skip-link" href="#shell-main">
        Skip to notes
      </a>

      <TopBar onOpenPersonalize={() => setIsPersonalizeOpen(true)} />

      <div className="shell__panes">
        <section className="shell-pane shell-pane--list" aria-label="Note list">
          {/*
            The selection state belongs to the pane rather than to the list, because
            the row that acts on it lives above the list's scroll port: the ticked
            notes and the actions that change them have to be able to reach each
            other without the list having to own the pane.
          */}
          <NoteSelectionProvider>
            {/* The name of the workspace, then the selection row, then the list.
                All three sit above the scroll port, so a tag heading and the row
                that acts on a selection never scroll away from the notes they
                describe. The heading steps down to h2 while a note is open, because
                the open note's title is the page's h1. */}
            <NotesWorkspaceHeader headingLevel={isEditorScreen ? 2 : 1} />

            <NotesSelectionBar />

            <div
              ref={setListRef}
              id="shell-list"
              tabIndex={-1}
              className="shell-pane__focus-target"
            >
              <NotesList />
            </div>
          </NoteSelectionProvider>
        </section>

        {/*
          `tabIndex={-1}` makes the skip link target focusable. Without it the
          browser only scrolls and a keyboard user's focus stays behind.
        */}
        <main id="shell-main" tabIndex={-1} className="shell-pane shell-pane--editor">
          {children}
        </main>
      </div>

      {/*
        The floating action button is the mobile counterpart of the top bar
        button. Both stay mounted and CSS decides which one is visible, so
        neither needs to know the viewport.
      */}
      <div className="shell-fab-layer">
        <NewNoteButton variant="fab" />
      </div>

      <BottomNav onOpenPersonalize={() => setIsPersonalizeOpen(true)} />

      <PersonalizeDialog isOpen={isPersonalizeOpen} onClose={closePersonalize} />
    </div>
  )
}