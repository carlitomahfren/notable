import { selectedNoteIdFromPathname } from "@/lib/notes/routes"

export interface ShellState {
  isSearchOpen: boolean
  titleFocusRequested: boolean
  listFocusRequested: boolean
}

export type ShellAction =
  | { type: "searchOpened" }
  | { type: "searchClosed" }
  | { type: "searchToggled" }
  | { type: "titleFocusRequested" }
  | { type: "titleFocusConsumed" }
  | { type: "listFocusRequested" }
  | { type: "listFocusConsumed" }

export const initialShellState: ShellState = {
  isSearchOpen: false,
  titleFocusRequested: false,
  listFocusRequested: false,
}

export function shellReducer(
  state: ShellState,
  action: ShellAction,
): ShellState {
  switch (action.type) {
    case "searchOpened":
      return state.isSearchOpen ? state : { ...state, isSearchOpen: true }

    case "searchClosed":
      return state.isSearchOpen ? { ...state, isSearchOpen: false } : state

    case "searchToggled":
      return state.isSearchOpen
        ? { ...state, isSearchOpen: false }
        : { ...state, isSearchOpen: true }

    case "titleFocusRequested":
      return state.titleFocusRequested
        ? state
        : { ...state, titleFocusRequested: true }

    case "titleFocusConsumed":
      return state.titleFocusRequested
        ? { ...state, titleFocusRequested: false }
        : state

    case "listFocusRequested":
      return state.listFocusRequested
        ? state
        : { ...state, listFocusRequested: true }

    case "listFocusConsumed":
      return state.listFocusRequested
        ? { ...state, listFocusRequested: false }
        : state
  }
}

export function isEditorScreenPath(pathname: string): boolean {
  return selectedNoteIdFromPathname(pathname) !== null
}