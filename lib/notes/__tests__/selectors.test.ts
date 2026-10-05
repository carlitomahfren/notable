import { beforeEach, describe, expect, it } from "vitest"

import type { Note } from "@/types/note"
import {
  filterNotes,
  getDisplayTitle,
  getTagSummaries,
  getVisibleNotes,
  searchNotes,
  sortNotes,
  UNTITLED_NOTE_LABEL,
} from "@/lib/notes/selectors"

import { makeNote, resetNoteIds } from "./note-factory"

beforeEach(() => {
  resetNoteIds()
})

describe("getDisplayTitle", () => {
  it("returns the title when present", () => {
    expect(getDisplayTitle(makeNote({ title: "React Study" }))).toBe(
      "React Study",
    )
  })

  it("falls back to Untitled for an empty title", () => {
    expect(getDisplayTitle(makeNote({ title: "" }))).toBe(UNTITLED_NOTE_LABEL)
  })

  it("falls back to Untitled for a whitespace-only title", () => {
    expect(getDisplayTitle(makeNote({ title: "   " }))).toBe(
      UNTITLED_NOTE_LABEL,
    )
  })
})

describe("searchNotes", () => {
  const notes: Note[] = [
    makeNote({ title: "React Study Notes", content: "Server components" }),
    makeNote({ title: "Shopping", content: "Buy #react gear", tags: ["home"] }),
    makeNote({ title: "Work", content: "Standup", tags: ["react", "work"] }),
  ]

  it("returns a copy of all notes for an empty query", () => {
    const result = searchNotes(notes, "")

    expect(result).toHaveLength(3)
    expect(result).not.toBe(notes)
  })

  it("does not filter for a whitespace-only query", () => {
    expect(searchNotes(notes, "   ")).toHaveLength(3)
  })

  it("matches the title case-insensitively", () => {
    expect(searchNotes(notes, "REACT STUDY")).toHaveLength(1)
  })

  it("matches the title case-sensitively when casing differs only in case", () => {
    expect(searchNotes(notes, "react")[0].title).toBe("React Study Notes")
  })

  it("matches content", () => {
    expect(searchNotes(notes, "standup")).toHaveLength(1)
  })

  it("matches tags", () => {
    expect(searchNotes(notes, "home")).toHaveLength(1)
  })

  it("matches a tag regardless of case", () => {
    expect(searchNotes(notes, "WORK")).toHaveLength(1)
  })

  it("matches partial substrings", () => {
    expect(searchNotes(notes, "stud")).toHaveLength(1)
  })

  it("trims the query", () => {
    expect(searchNotes(notes, "  shopping  ")).toHaveLength(1)
  })

  it("returns an empty array when nothing matches", () => {
    expect(searchNotes(notes, "nonexistent")).toEqual([])
  })

  it("returns a new array and does not mutate the input", () => {
    const input = [...notes]
    searchNotes(input, "react")

    expect(input).toEqual(notes)
  })
})

describe("filterNotes", () => {
  const pinned = makeNote({ title: "Pinned", isPinned: true })
  const unpinned = makeNote({ title: "Unpinned" })
  const tagged = makeNote({ title: "Tagged", tags: ["school", "work"] })
  const notes = [pinned, unpinned, tagged]

  it("returns all notes for the all filter", () => {
    expect(filterNotes(notes, { kind: "all" })).toHaveLength(3)
  })

  it("returns only pinned notes for the pinned filter", () => {
    const result = filterNotes(notes, { kind: "pinned" })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(pinned.id)
  })

  it("returns an empty array when nothing is pinned", () => {
    expect(filterNotes([unpinned], { kind: "pinned" })).toEqual([])
  })

  it("returns notes carrying a tag", () => {
    const result = filterNotes(notes, { kind: "tag", tag: "school" })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(tagged.id)
  })

  it("matches tags case-insensitively", () => {
    expect(filterNotes(notes, { kind: "tag", tag: "SCHOOL" })).toHaveLength(1)
  })

  it("requires every tag on a multi-tag note", () => {
    expect(filterNotes(notes, { kind: "tag", tag: "work" })).toHaveLength(1)
  })

  it("returns an empty array for an unknown tag", () => {
    expect(filterNotes(notes, { kind: "tag", tag: "nope" })).toEqual([])
  })
})

describe("sortNotes", () => {
  it("puts pinned notes first", () => {
    const older = makeNote({ updatedAt: "2026-03-01T00:00:00.000Z" })
    const pinned = makeNote({
      updatedAt: "2026-01-01T00:00:00.000Z",
      isPinned: true,
    })

    expect(sortNotes([older, pinned]).map((note) => note.id)).toEqual([
      pinned.id,
      older.id,
    ])
  })

  it("orders unpinned notes by updatedAt descending", () => {
    const older = makeNote({ updatedAt: "2026-01-01T00:00:00.000Z" })
    const newer = makeNote({ updatedAt: "2026-02-01T00:00:00.000Z" })

    expect(sortNotes([older, newer]).map((note) => note.id)).toEqual([
      newer.id,
      older.id,
    ])
  })

  it("orders pinned notes among themselves by updatedAt descending", () => {
    const olderPinned = makeNote({
      updatedAt: "2026-01-01T00:00:00.000Z",
      isPinned: true,
    })
    const newerPinned = makeNote({
      updatedAt: "2026-02-01T00:00:00.000Z",
      isPinned: true,
    })

    expect(sortNotes([olderPinned, newerPinned]).map((note) => note.id)).toEqual(
      [newerPinned.id, olderPinned.id],
    )
  })

  it("breaks updatedAt ties deterministically by id", () => {
    const first = makeNote({ updatedAt: "2026-01-01T00:00:00.000Z" })
    const second = makeNote({ updatedAt: "2026-01-01T00:00:00.000Z" })
    const expected = [first.id, second.id].sort()

    expect(sortNotes([first, second]).map((note) => note.id)).toEqual(expected)
    expect(sortNotes([second, first]).map((note) => note.id)).toEqual(expected)
  })

  it("does not mutate the input array", () => {
    const older = makeNote({ updatedAt: "2026-01-01T00:00:00.000Z" })
    const newer = makeNote({ updatedAt: "2026-02-01T00:00:00.000Z" })
    const input = [older, newer]

    sortNotes(input)

    expect(input).toEqual([older, newer])
  })

  it("returns an empty array for no notes", () => {
    expect(sortNotes([])).toEqual([])
  })
})

describe("getVisibleNotes", () => {
  it("applies pinned-first ordering with updatedAt descending", () => {
    const notes = [
      makeNote({ title: "Older", updatedAt: "2026-01-01T00:00:00.000Z" }),
      makeNote({
        title: "Pinned older",
        updatedAt: "2026-01-01T00:00:00.000Z",
        isPinned: true,
      }),
      makeNote({ title: "Newest", updatedAt: "2026-03-01T00:00:00.000Z" }),
      makeNote({
        title: "Pinned newest",
        updatedAt: "2026-02-01T00:00:00.000Z",
        isPinned: true,
      }),
    ]

    expect(getVisibleNotes(notes, {
      filter: { kind: "all" },
      searchQuery: "",
    }).map((note) => note.title)).toEqual([
      "Pinned newest",
      "Pinned older",
      "Newest",
      "Older",
    ])
  })

  it("combines search with the pinned filter", () => {
    const notes = [
      makeNote({ title: "React notes", isPinned: true }),
      makeNote({ title: "React tips" }),
      makeNote({ title: "Groceries" }),
    ]

    const result = getVisibleNotes(notes, {
      filter: { kind: "pinned" },
      searchQuery: "react",
    })

    expect(result.map((note) => note.title)).toEqual(["React notes"])
  })

  it("combines search with a tag filter", () => {
    const notes = [
      makeNote({ title: "React school", tags: ["school"] }),
      makeNote({ title: "React work", tags: ["work"] }),
    ]

    const result = getVisibleNotes(notes, {
      filter: { kind: "tag", tag: "school" },
      searchQuery: "react",
    })

    expect(result.map((note) => note.title)).toEqual(["React school"])
  })

  it("returns an empty array when search matches nothing", () => {
    const notes = [makeNote({ title: "React" })]

    expect(
      getVisibleNotes(notes, { filter: { kind: "all" }, searchQuery: "zzz" }),
    ).toEqual([])
  })

  it("returns everything for an empty query and the all filter", () => {
    const notes = [makeNote(), makeNote(), makeNote()]

    expect(
      getVisibleNotes(notes, { filter: { kind: "all" }, searchQuery: "" }),
    ).toHaveLength(3)
  })

  it("does not mutate the input array", () => {
    const notes = [makeNote({ updatedAt: "2026-01-01T00:00:00.000Z" }), makeNote()]
    const input = [...notes]

    getVisibleNotes(input, { filter: { kind: "all" }, searchQuery: "" })

    expect(input).toEqual(notes)
  })
})

describe("getTagSummaries", () => {
  it("returns an empty array for no tags", () => {
    expect(getTagSummaries([makeNote()])).toEqual([])
  })

  it("counts notes per tag", () => {
    const notes = [
      makeNote({ tags: ["school", "work"] }),
      makeNote({ tags: ["school"] }),
    ]

    expect(getTagSummaries(notes)).toEqual([
      { tag: "school", count: 2 },
      { tag: "work", count: 1 },
    ])
  })

  it("orders by count descending then alphabetically", () => {
    const notes = [
      makeNote({ tags: ["work", "ideas"] }),
      makeNote({ tags: ["ideas"] }),
      makeNote({ tags: ["ideas"] }),
    ]

    expect(getTagSummaries(notes).map((summary) => summary.tag)).toEqual([
      "ideas",
      "work",
    ])
  })

  it("counts a tag only once per note", () => {
    const notes = [makeNote({ tags: ["school", "school"] })]

    expect(getTagSummaries(notes)).toEqual([{ tag: "school", count: 1 }])
  })

  it("handles an empty note list", () => {
    expect(getTagSummaries([])).toEqual([])
  })
})