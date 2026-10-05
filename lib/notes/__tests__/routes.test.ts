import { describe, expect, it } from "vitest"

import { NOTE_LIST_PATH, notePath, selectedNoteIdFromPathname } from "@/lib/notes/routes"

describe("notePath", () => {
  it("builds a note detail path", () => {
    expect(notePath("abc")).toBe("/notes/abc")
  })

  it("exposes the list path", () => {
    expect(NOTE_LIST_PATH).toBe("/notes")
  })
})

describe("selectedNoteIdFromPathname", () => {
  it("returns the note id for a note route", () => {
    expect(selectedNoteIdFromPathname("/notes/abc-123")).toBe("abc-123")
  })

  it("returns null for the list route", () => {
    expect(selectedNoteIdFromPathname("/notes")).toBeNull()
  })

  it("returns null for the bare notes segment", () => {
    expect(selectedNoteIdFromPathname("/notes/")).toBeNull()
  })

  it("returns null for the root route", () => {
    expect(selectedNoteIdFromPathname("/")).toBeNull()
  })

  it("returns null for unrelated routes", () => {
    expect(selectedNoteIdFromPathname("/settings")).toBeNull()
  })

  it("does not treat a similarly named route as a note", () => {
    expect(selectedNoteIdFromPathname("/notes-archive/abc")).toBeNull()
  })

  it("preserves note ids that contain a slash-free uuid shape", () => {
    expect(
      selectedNoteIdFromPathname("/notes/3f2504e0-4f89-41d3-9a0c-0305e82c3301"),
    ).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301")
  })
})