import type { ReactElement, ReactNode } from "react"

import { NOTES_STORAGE_KEY } from "@/lib/notes/notes-repository"
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/settings-repository"
import { LocalStorageNotesRepository } from "@/lib/notes/notes-repository"
import { LocalStorageSettingsRepository } from "@/lib/settings/settings-repository"
import { NotesProvider } from "@/components/providers/notes-provider"
import { ShellProvider } from "@/components/shell/shell-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { WorkspaceProvider } from "@/components/providers/workspace-provider"
import type { Note } from "@/types/note"

import { flush, render } from "./test-render"

/**
 * Writes notes straight to storage and marks welcome notes as already seeded,
 * so list tests never inherit first-run content.
 */
export async function seedStorage(notes: Note[]): Promise<void> {
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes))
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ welcomeNotesSeeded: true }),
  )

  await flush()
}

export function clearStorage(): void {
  localStorage.clear()
}

export function storedNotes(): Note[] {
  const raw = localStorage.getItem(NOTES_STORAGE_KEY)

  return raw === null ? [] : (JSON.parse(raw) as Note[])
}

export function repository(): LocalStorageNotesRepository {
  return new LocalStorageNotesRepository()
}

/** Renders a tree inside the real provider stack and waits for hydration. */
export async function renderWithProviders(
  element: ReactElement,
  setup?: ReactNode,
): Promise<HTMLElement> {
  const container = await render(
    <ThemeProvider>
      <NotesProvider
        repository={repository()}
        settingsRepository={new LocalStorageSettingsRepository()}
      >
        <WorkspaceProvider>
          <ShellProvider>
            {setup}
            {element}
          </ShellProvider>
        </WorkspaceProvider>
      </NotesProvider>
    </ThemeProvider>,
  )

  await flush(6)

  return container
}