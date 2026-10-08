import { describe, expect, it } from "vitest"

import {
  initialShellState,
  isEditorScreenPath,
  shellReducer,
  type ShellState,
} from "@/components/shell/shell-state"

const CLOSED: ShellState = {
  isSearchOpen: false,
  titleFocusRequested: false,
  listFocusRequested: false,
}

const SEARCH_OPEN: ShellState = { ...CLOSED, isSearchOpen: true }
const TITLE_REQUESTED: ShellState = { ...CLOSED, titleFocusRequested: true }

describe("shellReducer", () => {
  it("starts with nothing expanded and no pending title focus", () => {
    expect(initialShellState).toEqual(CLOSED)
  })

  it("opens search", () => {
    expect(shellReducer(CLOSED, { type: "searchOpened" })).toEqual(SEARCH_OPEN)
  })

  it("keeps the same state when search is already open", () => {
    expect(shellReducer(SEARCH_OPEN, { type: "searchOpened" })).toBe(SEARCH_OPEN)
  })

  it("closes search", () => {
    expect(shellReducer(SEARCH_OPEN, { type: "searchClosed" })).toEqual(CLOSED)
  })

  it("keeps the same state when closing search that is already closed", () => {
    expect(shellReducer(CLOSED, { type: "searchClosed" })).toBe(CLOSED)
  })

  it("toggles search open and closed", () => {
    const opened = shellReducer(CLOSED, { type: "searchToggled" })

    expect(opened).toEqual(SEARCH_OPEN)
    expect(shellReducer(opened, { type: "searchToggled" })).toEqual(CLOSED)
  })

  it("never mutates the previous state", () => {
    const previous = CLOSED

    shellReducer(previous, { type: "searchToggled" })

    expect(previous).toEqual(CLOSED)
  })

  it("records a title focus request", () => {
    expect(shellReducer(CLOSED, { type: "titleFocusRequested" })).toEqual(
      TITLE_REQUESTED,
    )
  })

  it("keeps the same state when a title focus is already requested", () => {
    expect(
      shellReducer(TITLE_REQUESTED, { type: "titleFocusRequested" }),
    ).toBe(TITLE_REQUESTED)
  })

  it("consumes a title focus request so it happens only once", () => {
    expect(
      shellReducer(TITLE_REQUESTED, { type: "titleFocusConsumed" }),
    ).toEqual(CLOSED)
    expect(shellReducer(CLOSED, { type: "titleFocusConsumed" })).toBe(CLOSED)
  })

  it("keeps the expanded panels and the title focus request independent", () => {
    const both = shellReducer(SEARCH_OPEN, { type: "titleFocusRequested" })

    expect(both).toEqual({
      isSearchOpen: true,
      titleFocusRequested: true,
      listFocusRequested: false,
    })
  })

  it("records and consumes a list focus request", () => {
    const requested = shellReducer(CLOSED, { type: "listFocusRequested" })

    expect(requested).toEqual({
      isSearchOpen: false,
      titleFocusRequested: false,
      listFocusRequested: true,
    })

    // Requesting twice must not queue a second move.
    expect(shellReducer(requested, { type: "listFocusRequested" })).toBe(requested)

    expect(shellReducer(requested, { type: "listFocusConsumed" })).toEqual(CLOSED)
    expect(shellReducer(CLOSED, { type: "listFocusConsumed" })).toBe(CLOSED)
  })

  it("keeps list and title focus requests independent", () => {
    const both = shellReducer(TITLE_REQUESTED, { type: "listFocusRequested" })

    expect(both).toEqual({
      isSearchOpen: false,
      titleFocusRequested: true,
      listFocusRequested: true,
    })
  })

  it("keeps focus requests independent of the expanded panels", () => {
    const both = shellReducer(SEARCH_OPEN, { type: "listFocusRequested" })

    expect(both.isSearchOpen).toBe(true)
    expect(both.listFocusRequested).toBe(true)
  })
})

describe("isEditorScreenPath", () => {
  it("treats the notes list route as the list screen", () => {
    expect(isEditorScreenPath("/notes")).toBe(false)
  })

  it("treats a note route as the editor screen", () => {
    expect(isEditorScreenPath("/notes/abc-123")).toBe(true)
  })

  it("treats a bare notes segment as the list screen", () => {
    expect(isEditorScreenPath("/notes/")).toBe(false)
  })

  it("treats the root route as the list screen", () => {
    expect(isEditorScreenPath("/")).toBe(false)
  })

  it("treats unrelated routes as the list screen", () => {
    expect(isEditorScreenPath("/settings")).toBe(false)
  })
})