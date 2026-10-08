import { describe, expect, it } from "vitest"
import {
  isNote,
  isLegacyNote,
  migrateLegacyNotes,
  parseNotes,
} from "@/lib/notes/note-guard"

const validNote = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "React Study Notes",
  content: "# Heading",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  isPinned: false,
  order: 0,
  tags: ["school"],
}

describe("isNote", () => {
  it("accepts a well-formed note", () => {
    expect(isNote(validNote)).toBe(true)
  })

  it("accepts an empty title", () => {
    expect(isNote({ ...validNote, title: "" })).toBe(true)
  })

  it("accepts an empty content string", () => {
    expect(isNote({ ...validNote, content: "" })).toBe(true)
  })

  it("accepts an empty tags array", () => {
    expect(isNote({ ...validNote, tags: [] })).toBe(true)
  })

  it("accepts a zero order", () => {
    expect(isNote({ ...validNote, order: 0 })).toBe(true)
  })

  it("accepts timestamps without milliseconds", () => {
    expect(
      isNote({ ...validNote, createdAt: "2026-01-01T00:00:00Z" }),
    ).toBe(true)
  })

  it("rejects null and undefined", () => {
    expect(isNote(null)).toBe(false)
    expect(isNote(undefined)).toBe(false)
  })

  it("rejects primitives", () => {
    expect(isNote("note")).toBe(false)
    expect(isNote(42)).toBe(false)
    expect(isNote(true)).toBe(false)
  })

  it("rejects arrays", () => {
    expect(isNote([])).toBe(false)
    expect(isNote([validNote])).toBe(false)
  })

  it("rejects a missing id", () => {
    expect(isNote({ ...validNote, id: undefined })).toBe(false)
  })

  it("rejects an empty id", () => {
    expect(isNote({ ...validNote, id: "" })).toBe(false)
  })

  it("rejects a non-string title or content", () => {
    expect(isNote({ ...validNote, title: 1 })).toBe(false)
    expect(isNote({ ...validNote, content: null })).toBe(false)
  })

  it("rejects a non-boolean isPinned", () => {
    expect(isNote({ ...validNote, isPinned: "false" })).toBe(false)
  })

  it("rejects a non-number order", () => {
    expect(isNote({ ...validNote, order: "first" })).toBe(false)
    expect(isNote({ ...validNote, order: null })).toBe(false)
    expect(isNote({ ...validNote, order: undefined })).toBe(false)
  })

  it("rejects a date-only timestamp", () => {
    expect(isNote({ ...validNote, createdAt: "2026-01-01" })).toBe(false)
  })

  it("rejects a non-UTC timestamp", () => {
    expect(isNote({ ...validNote, updatedAt: "2026-01-01T00:00:00+02:00" })).toBe(
      false,
    )
  })

  it("rejects an unparseable timestamp", () => {
    expect(isNote({ ...validNote, createdAt: "2026-13-45T99:99:99.000Z" })).toBe(
      false,
    )
  })

  it("rejects non-string tags", () => {
    expect(isNote({ ...validNote, tags: "school" })).toBe(false)
    expect(isNote({ ...validNote, tags: ["school", 5] })).toBe(false)
    expect(isNote({ ...validNote, tags: [null] })).toBe(false)
  })
})

describe("isLegacyNote", () => {
  const legacy = { ...validNote }
  delete (legacy as Record<string, unknown>).order

  it("accepts a note with every field but order", () => {
    expect(isLegacyNote(legacy)).toBe(true)
    expect(isLegacyNote(validNote)).toBe(false)
  })

  it("rejects a note carrying an order", () => {
    expect(isLegacyNote(validNote)).toBe(false)
  })

  it("rejects anything a current note would also reject", () => {
    expect(isLegacyNote({ ...legacy, id: "" })).toBe(false)
    expect(isLegacyNote({ ...legacy, isPinned: true })).toBe(true)
  })
})

describe("parseNotes", () => {
  it("returns an empty array for an empty array", () => {
    expect(parseNotes([])).toEqual([])
  })

  it("returns the notes for a valid list", () => {
    expect(parseNotes([validNote])).toEqual([validNote])
  })

  it("returns null for a non-array", () => {
    expect(parseNotes(null)).toBeNull()
    expect(parseNotes({})).toBeNull()
    expect(parseNotes("[]")).toBeNull()
  })

  it("returns null when any element is invalid", () => {
    expect(parseNotes([validNote, { foo: "bar" }])).toBeNull()
    expect(parseNotes([{ foo: "bar" }])).toBeNull()
  })

  it("returns null when a legacy note is missing its order", () => {
    const legacy = { ...validNote }
    delete (legacy as Record<string, unknown>).order

    expect(parseNotes([legacy])).toBeNull()
  })

  it("does not alias the input array", () => {
    const input = [validNote]
    const parsed = parseNotes(input)

    expect(parsed).not.toBe(input)
    expect(parsed?.[0]).toBe(validNote)
  })
})

describe("migrateLegacyNotes", () => {
  const legacy = (overrides: Partial<Record<string, unknown>> = {}) => {
    const note: Record<string, unknown> = { ...validNote }
    delete note.order

    return { ...note, ...overrides }
  }

  it("gives each legacy note the slot it already occupies", () => {
    const migrated = migrateLegacyNotes([legacy(), legacy()])

    expect(migrated?.[0].order).toBe(0)
    expect(migrated?.[1].order).toBe(1)
  })

  it("keeps every other field as it was stored", () => {
    const migrated = migrateLegacyNotes([legacy({ title: "Kept" })])

    expect(migrated?.[0]).toMatchObject({ title: "Kept", order: 0 })
  })

  it("returns null for anything that is not a valid legacy note", () => {
    expect(migrateLegacyNotes([legacy(), { foo: "bar" }])).toBeNull()
    expect(migrateLegacyNotes("notes")).toBeNull()
    expect(migrateLegacyNotes([validNote])).toBeNull()
  })

  it("returns an empty list for an empty list", () => {
    expect(migrateLegacyNotes([])).toEqual([])
  })
})