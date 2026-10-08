"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type WorkspaceView =
  | { kind: "all" }
  | { kind: "pinned" }
  | { kind: "tags" }
  | { kind: "tag"; tag: string }

export interface WorkspaceState {
  view: WorkspaceView
  searchQuery: string
}

export interface WorkspaceActions {
  setView(view: WorkspaceView): void
  setSearchQuery(query: string): void
}

const WorkspaceStateContext = createContext<WorkspaceState | null>(null)
const WorkspaceActionsContext = createContext<WorkspaceActions | null>(null)

export const initialWorkspaceState: WorkspaceState = {
  view: { kind: "all" },
  searchQuery: "",
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialWorkspaceState)

  const setView = useCallback((view: WorkspaceView) => {
    setState((current) => ({ ...current, view }))
  }, [])

  const setSearchQuery = useCallback((searchQuery: string) => {
    setState((current) => ({ ...current, searchQuery }))
  }, [])

  const actions = useMemo<WorkspaceActions>(
    () => ({ setView, setSearchQuery }),
    [setView, setSearchQuery],
  )

  return (
    <WorkspaceStateContext.Provider value={state}>
      <WorkspaceActionsContext.Provider value={actions}>
        {children}
      </WorkspaceActionsContext.Provider>
    </WorkspaceStateContext.Provider>
  )
}

export function useWorkspaceState(): WorkspaceState {
  const context = useContext(WorkspaceStateContext)

  if (context === null) {
    throw new Error("useWorkspaceState must be used within a WorkspaceProvider")
  }

  return context
}

export function useWorkspaceActions(): WorkspaceActions {
  const context = useContext(WorkspaceActionsContext)

  if (context === null) {
    throw new Error(
      "useWorkspaceActions must be used within a WorkspaceProvider",
    )
  }

  return context
}