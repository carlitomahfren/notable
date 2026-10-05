"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"

import { initialShellState, isEditorScreenPath, shellReducer } from "./shell-state"

export interface ShellContextValue {
  isSearchOpen: boolean
  isTagsOpen: boolean
  isEditorScreen: boolean
  openSearch: () => void
  closeSearch: () => void
  toggleSearch: () => void
  openTags: () => void
  closeTags: () => void
  toggleTags: () => void
  setListRef: (element: HTMLElement | null) => void
  setTitleRef: (element: HTMLElement | null) => void
  focusList: () => void
  focusTitle: () => void
  requestTitleFocus: () => void
  consumeTitleFocus: () => boolean
  requestListFocus: () => void
  consumeListFocus: () => boolean
}

const ShellContext = createContext<ShellContextValue | null>(null)

export function ShellProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(shellReducer, initialShellState)
  const pathname = usePathname()
  const listRef = useRef<HTMLElement | null>(null)
  const titleRef = useRef<HTMLElement | null>(null)

  const openSearch = useCallback(() => {
    dispatch({ type: "searchOpened" })
  }, [])

  const closeSearch = useCallback(() => {
    dispatch({ type: "searchClosed" })
  }, [])

  const toggleSearch = useCallback(() => {
    dispatch({ type: "searchToggled" })
  }, [])

  const openTags = useCallback(() => {
    dispatch({ type: "tagsOpened" })
  }, [])

  const closeTags = useCallback(() => {
    dispatch({ type: "tagsClosed" })
  }, [])

  const toggleTags = useCallback(() => {
    dispatch({ type: "tagsToggled" })
  }, [])

  const setListRef = useCallback((element: HTMLElement | null) => {
    listRef.current = element
  }, [])

  const setTitleRef = useCallback((element: HTMLElement | null) => {
    titleRef.current = element
  }, [])

  const focusList = useCallback(() => {
    listRef.current?.focus()
  }, [])

  const focusTitle = useCallback(() => {
    titleRef.current?.focus()
  }, [])

  const requestTitleFocus = useCallback(() => {
    dispatch({ type: "titleFocusRequested" })
  }, [])

  const consumeTitleFocus = useCallback(() => {
    if (!state.titleFocusRequested) {
      return false
    }

    dispatch({ type: "titleFocusConsumed" })

    return true
  }, [state.titleFocusRequested])

  const requestListFocus = useCallback(() => {
    dispatch({ type: "listFocusRequested" })
  }, [])

  const consumeListFocus = useCallback(() => {
    if (!state.listFocusRequested) {
      return false
    }

    dispatch({ type: "listFocusConsumed" })

    return true
  }, [state.listFocusRequested])

  const value = useMemo<ShellContextValue>(
    () => ({
      isSearchOpen: state.isSearchOpen,
      isTagsOpen: state.isTagsOpen,
      isEditorScreen: isEditorScreenPath(pathname),
      openSearch,
      closeSearch,
      toggleSearch,
      openTags,
      closeTags,
      toggleTags,
      setListRef,
      setTitleRef,
      focusList,
      focusTitle,
      requestTitleFocus,
      consumeTitleFocus,
      requestListFocus,
      consumeListFocus,
    }),
    [
      state.isSearchOpen,
      state.isTagsOpen,
      pathname,
      openSearch,
      closeSearch,
      toggleSearch,
      openTags,
      closeTags,
      toggleTags,
      setListRef,
      setTitleRef,
      focusList,
      focusTitle,
      requestTitleFocus,
      consumeTitleFocus,
      requestListFocus,
      consumeListFocus,
    ],
  )

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext)

  if (context === null) {
    throw new Error("useShell must be used within a ShellProvider")
  }

  return context
}