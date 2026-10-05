import { selectedNoteIdFromPathname } from "@/lib/notes/routes"

export interface ShellState {
  isSearchOpen: boolean
  isTagsOpen: boolean
  titleFocusRequested: boolean
  listFocusRequested: boolean
}

export type ShellAction =
  | { type: "searchOpened" }
  | { type: "searchClosed" }
  | { type: "searchToggled" }
  | { type: "tagsOpened" }
  | { type: "tagsClosed" }
  | { type: "tagsToggled" }
  | { type: "titleFocusRequested" }
  | { type: "titleFocusConsumed" }
  | { type: "listFocusRequested" }
  | { type: "listFocusConsumed" }

export const initialShellState: ShellState = {
  isSearchOpen: false,
  isTagsOpen: false,
  titleFocusRequested: false,
  listFocusRequested: false,
}

/*
 * Search and tags both live in the top chrome, so only one of them may be open
 * at a time. Closing one on open keeps the navigation bar from growing two
 * panels deep on narrow screens.
 */
export function shellReducer(
  state: ShellState,
  action: ShellAction,
): ShellState {
  switch (action.type) {
    case "searchOpened":
      return state.isSearchOpen && !state.isTagsOpen
        ? state
        : { ...state, isSearchOpen: true, isTagsOpen: false }

    case "searchClosed":
      return state.isSearchOpen ? { ...state, isSearchOpen: false } : state

    case "searchToggled":
      return state.isSearchOpen
        ? { ...state, isSearchOpen: false }
        : { ...state, isSearchOpen: true, isTagsOpen: false }

    case "tagsOpened":
      return state.isTagsOpen && !state.isSearchOpen
        ? state
        : { ...state, isTagsOpen: true, isSearchOpen: false }

    case "tagsClosed":
      return state.isTagsOpen ? { ...state, isTagsOpen: false } : state

    case "tagsToggled":
      return state.isTagsOpen
        ? { ...state, isTagsOpen: false }
        : { ...state, isTagsOpen: true, isSearchOpen: false }

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