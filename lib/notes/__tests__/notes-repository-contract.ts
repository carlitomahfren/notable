import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NoteInput } from "@/types/note"
import type { NotesRepository } from "@/lib/notes/notes-repository"

export interface NotesRepositoryHarness {
  createRepository: () => NotesRepository
  reset: () => void | Promise<void>
}

const T0 = "2026-01-01T00:00:00.000Z"
const T1 = "2026-01-02T00:00:00.000Z"
const T2 = "2026-01-03T00:00:00.000Z"

function input(overrides: Partial<NoteInput> = {}): NoteInput {
  return {
    title: "React Study Notes",
    content: "# Heading\n\nSome **content**.",
    tags: ["school"],
    ...overrides,
  }
}

export function describeNotesRepositoryContract(
  name: string,
  harness: NotesRepositoryHarness,
): void {
  describe(`${name} NotesRepository contract`, () => {
    let repository: NotesRepository

    beforeEach(async () => {
      await harness.reset()
      repository = harness.createRepository()
      vi.useFakeTimers()
      vi.setSystemTime(new Date(T0))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe("create", () => {
      it("assigns an id and returns the stored note", async () => {
        const note = await repository.create(input())

        expect(note.id).toEqual(expect.any(String))
        expect(note.id.length).toBeGreaterThan(0)
        expect(note.title).toBe("React Study Notes")
      })

      it("generates a distinct id per note", async () => {
        const first = await repository.create(input())
        const second = await repository.create(input())

        expect(first.id).not.toBe(second.id)
      })

      it("sets createdAt and updatedAt to the same instant", async () => {
        const note = await repository.create(input())

        expect(note.createdAt).toBe(T0)
        expect(note.updatedAt).toBe(T0)
      })

      it("defaults isPinned to false", async () => {
        const note = await repository.create(input())

        expect(note.isPinned).toBe(false)
      })

      it("persists ISO 8601 UTC timestamps", async () => {
        const note = await repository.create(input())

        expect(note.createdAt).toMatch(/Z$/)
        expect(Number.isNaN(Date.parse(note.createdAt))).toBe(false)
      })

      it("does not normalize tags supplied by the caller", async () => {
        const note = await repository.create(
          input({ tags: ["  #School  ", "SCHOOL"] }),
        )

        expect(note.tags).toEqual(["  #School  ", "SCHOOL"])
      })

      it("does not retain a reference to the caller's tags array", async () => {
        const tags = ["school"]
        const note = await repository.create(input({ tags }))

        tags.push("tampered")

        expect(note.tags).toEqual(["school"])
        const reloaded = await repository.getById(note.id)
        expect(reloaded?.tags).toEqual(["school"])
      })

      it("assigns ascending orders to successive notes", async () => {
        const first = await repository.create(input())
        const second = await repository.create(input())

        expect(first.order).toBeLessThan(second.order)
      })

      it("places a new note after every note already stored", async () => {
        await repository.create(input({ title: "One" }))
        await repository.create(input({ title: "Two" }))
        const created = await repository.create(input({ title: "Three" }))

        const notes = await repository.getAll()

        expect(notes.find((note) => note.id === created.id)?.order).toBe(
          Math.max(...notes.map((note) => note.order)),
        )
      })

      it("allows an empty title", async () => {
        const note = await repository.create(input({ title: "" }))

        expect(note.title).toBe("")
      })
    })

    describe("getAll", () => {
      it("returns an empty list when nothing is stored", async () => {
        await expect(repository.getAll()).resolves.toEqual([])
      })

      it("returns every created note", async () => {
        await repository.create(input({ title: "One" }))
        await repository.create(input({ title: "Two" }))

        const notes = await repository.getAll()

        expect(notes).toHaveLength(2)
        expect(notes.map((note) => note.title).sort()).toEqual(["One", "Two"])
      })
    })

    describe("getById", () => {
      it("returns the stored note", async () => {
        const created = await repository.create(input())

        const found = await repository.getById(created.id)

        expect(found).toEqual(created)
      })

      it("returns null when the note does not exist", async () => {
        await expect(repository.getById("missing-id")).resolves.toBeNull()
      })

      it("returns null after the note is deleted", async () => {
        const created = await repository.create(input())
        await repository.delete(created.id)

        await expect(repository.getById(created.id)).resolves.toBeNull()
      })
    })

    describe("update", () => {
      it("applies field-scoped changes", async () => {
        const created = await repository.create(input())

        const updated = await repository.update(created.id, { title: "Renamed" })

        expect(updated.title).toBe("Renamed")
        expect(updated.content).toBe(created.content)
        expect(updated.tags).toEqual(created.tags)
      })

      it("never changes createdAt", async () => {
        const created = await repository.create(input())
        vi.setSystemTime(new Date(T1))

        const updated = await repository.update(created.id, {
          title: "Renamed",
          isPinned: true,
        })

        expect(updated.createdAt).toBe(created.createdAt)
      })

      it("changes updatedAt when the title changes", async () => {
        const created = await repository.create(input())
        vi.setSystemTime(new Date(T1))

        const updated = await repository.update(created.id, { title: "Renamed" })

        expect(updated.updatedAt).toBe(T1)
      })

      it("changes updatedAt when the content changes", async () => {
        const created = await repository.create(input())
        vi.setSystemTime(new Date(T1))

        const updated = await repository.update(created.id, {
          content: "Rewritten",
        })

        expect(updated.updatedAt).toBe(T1)
      })

      it("changes updatedAt when the tags change", async () => {
        const created = await repository.create(input())
        vi.setSystemTime(new Date(T1))

        const updated = await repository.update(created.id, {
          tags: ["work"],
        })

        expect(updated.updatedAt).toBe(T1)
      })

      it("does NOT change updatedAt when only isPinned changes", async () => {
        const created = await repository.create(input())
        vi.setSystemTime(new Date(T1))

        const pinned = await repository.update(created.id, { isPinned: true })

        expect(pinned.isPinned).toBe(true)
        expect(pinned.updatedAt).toBe(created.updatedAt)
      })

      it("does NOT change updatedAt when unpinning", async () => {
        const created = await repository.create(input())
        const pinned = await repository.update(created.id, { isPinned: true })
        vi.setSystemTime(new Date(T1))

        const unpinned = await repository.update(created.id, { isPinned: false })

        expect(unpinned.isPinned).toBe(false)
        expect(unpinned.updatedAt).toBe(pinned.updatedAt)
      })

      it("treats an empty update as a no-op returning the current note", async () => {
        const created = await repository.create(input())
        vi.setSystemTime(new Date(T1))

        const updated = await repository.update(created.id, {})

        expect(updated).toEqual(created)
        expect(updated.updatedAt).toBe(created.updatedAt)
      })

      it("preserves omitted fields", async () => {
        const created = await repository.create(input())

        const updated = await repository.update(created.id, {
          content: "Rewritten",
        })

        expect(updated.title).toBe(created.title)
        expect(updated.tags).toEqual(created.tags)
        expect(updated.isPinned).toBe(created.isPinned)
      })

      it("does not normalize tags supplied by the caller", async () => {
        const created = await repository.create(input())

        const updated = await repository.update(created.id, {
          tags: ["  #Work  "],
        })

        expect(updated.tags).toEqual(["  #Work  "])
      })

      it("rejects when the note does not exist", async () => {
        await expect(
          repository.update("missing-id", { title: "Renamed" }),
        ).rejects.toThrow()
      })

      it("leaves other notes untouched", async () => {
        const first = await repository.create(input({ title: "One" }))
        const second = await repository.create(input({ title: "Two" }))
        vi.setSystemTime(new Date(T2))

        await repository.update(first.id, { title: "Renamed" })

        const reloaded = await repository.getById(second.id)
        expect(reloaded?.title).toBe("Two")
        expect(reloaded?.updatedAt).toBe(second.updatedAt)
      })
    })

    describe("delete", () => {
      it("removes the note", async () => {
        const created = await repository.create(input())

        await repository.delete(created.id)

        await expect(repository.getAll()).resolves.toEqual([])
      })

      it("is idempotent when repeated", async () => {
        const created = await repository.create(input())

        await repository.delete(created.id)
        await expect(repository.delete(created.id)).resolves.toBeUndefined()
      })

      it("is a no-op for an unknown id", async () => {
        const created = await repository.create(input())

        await expect(repository.delete("missing-id")).resolves.toBeUndefined()
        await expect(repository.getAll()).resolves.toHaveLength(1)
        expect(created.id).not.toBe("")
      })

      it("does not affect other notes", async () => {
        const first = await repository.create(input({ title: "One" }))
        const second = await repository.create(input({ title: "Two" }))

        await repository.delete(first.id)

        const remaining = await repository.getAll()
        expect(remaining).toHaveLength(1)
        expect(remaining[0].id).toBe(second.id)
      })
    })

    describe("reorder", () => {
      it("returns the array in exactly the requested order", async () => {
        const first = await repository.create(input({ title: "One" }))
        const second = await repository.create(input({ title: "Two" }))
        const third = await repository.create(input({ title: "Three" }))

        const reordered = await repository.reorder([
          third.id,
          first.id,
          second.id,
        ])

        expect(reordered.map((note) => note.id)).toEqual([
          third.id,
          first.id,
          second.id,
        ])
      })

      it("renumbers order to the new slots", async () => {
        const first = await repository.create(input())
        const second = await repository.create(input())

        await repository.reorder([second.id, first.id])

        const notes = await repository.getAll()

        expect(notes.find((note) => note.id === first.id)?.order).toBe(1)
        expect(notes.find((note) => note.id === second.id)?.order).toBe(0)
      })

      it("persists the new order across a reload", async () => {
        const first = await repository.create(input({ title: "One" }))
        const second = await repository.create(input({ title: "Two" }))

        await repository.reorder([second.id, first.id])

        const reloaded = await repository.getAll()

        expect(reloaded.map((note) => note.title)).toEqual(["Two", "One"])
      })

      it("changes nothing for an unchanged order", async () => {
        const first = await repository.create(input({ title: "One" }))
        const second = await repository.create(input({ title: "Two" }))

        const before = await repository.getAll()
        const result = await repository.reorder([first.id, second.id])
        const after = await repository.getAll()

        expect(result.map((note) => note.id)).toEqual(
          before.map((note) => note.id),
        )
        expect(after).toEqual(before)
      })

      it("does not touch timestamps or other fields", async () => {
        const first = await repository.create(input({ title: "One" }))
        const second = await repository.create(input({ title: "Two" }))

        await repository.reorder([second.id, first.id])

        const reloaded = await repository.getAll()

        expect(reloaded.find((note) => note.id === first.id)?.updatedAt).toBe(
          first.updatedAt,
        )
        expect(reloaded.find((note) => note.id === second.id)?.content).toBe(
          second.content,
        )
      })

      it("throws when the requested set is not exactly the stored set", async () => {
        const first = await repository.create(input({ title: "One" }))
        const second = await repository.create(input({ title: "Two" }))

        await expect(repository.reorder([first.id])).rejects.toThrow()
        await expect(repository.reorder([first.id, "missing"])).rejects.toThrow()
        await expect(
          repository.reorder([first.id, second.id, second.id]),
        ).rejects.toThrow()
      })

      it("orders a note created after a reorder at the end", async () => {
        const first = await repository.create(input({ title: "One" }))
        const second = await repository.create(input({ title: "Two" }))
        const third = await repository.create(input({ title: "Three" }))

        await repository.reorder([third.id, first.id, second.id])

        const created = await repository.create(input({ title: "Four" }))

        const notes = await repository.getAll()

        expect(notes[notes.length - 1].id).toBe(created.id)
        expect(created.order).toBe(3)
      })
    })
  })
}