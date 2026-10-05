"use client"

import { useMemo, type ReactNode } from "react"

import { LocalStorageNotesRepository } from "@/lib/notes/notes-repository"
import { LocalStorageSettingsRepository } from "@/lib/settings/settings-repository"

import { NotesProvider } from "./notes-provider"
import { ThemeProvider } from "./theme-provider"
import { WorkspaceProvider } from "./workspace-provider"

export interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  const repository = useMemo(() => new LocalStorageNotesRepository(), [])
  const settingsRepository = useMemo(
    () => new LocalStorageSettingsRepository(),
    [],
  )

  return (
    // Theme sits outside Notes so appearance never reaches note data, and
    // outside Workspace so opening a note cannot reset the theme.
    <ThemeProvider>
      <NotesProvider repository={repository} settingsRepository={settingsRepository}>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </NotesProvider>
    </ThemeProvider>
  )
}