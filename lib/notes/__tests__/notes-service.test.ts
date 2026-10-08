import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ValidationError } from "@/types/note"
import { NotesService } from "@/lib/notes/notes-service"
import {
  LocalStorageNotesRepository,
  NOTES_STORAGE_KEY,
  NoteNotFoundError,
  NotesStorageError,
} from "@/lib/notes/notes-repository"

import {
  clearBrowserStub,
  createMemoryStorage,
  stubBrowser,
} from "./memory-storage"

const T0 = "2026-01-01T00:00:00.000Z"
const T1 = "2026-01-02T00:00:00.000Z"

let storage: Storage
let service: NotesService

function storedNotes(): Array<Record<string, unknown>> {
  const raw = storage.getItem(NOTES_STORAGE_KEY)

  return raw === null ? [] : JSON.parse(raw)
}

function corruptStorage(): void {
  storage.setItem(NOTES_STORAGE_KEY, "{not json")
}

beforeEach(() => {
  storage = createMemoryStorage()
  stubBrowser(storage)
  service = new NotesService(new LocalStorageNotesRepository())
  vi.useFakeTimers()
  vi.setSystemTime(new Date(T0))
})

afterEach(() => {
  vi.useRealTimers()
  clearBrowserStub()
})

describe("NotesService createNote", () => {
  it("creates a note through the repository", async () => {
    const note = await service.createNote({
      title: "React Study",
      content: "# Heading",
      tags: ["school"],
    })

    expect(note.id).toEqual(expect.any(String))
    expect(note.title).toBe("React Study")
    expect(note.content).toBe("# Heading")
    expect(note.createdAt).toBe(T0)
    expect(note.updatedAt).toBe(T0)
    expect(note.isPinned).toBe(false)
  })

  it("normalizes tags before they reach the repository", async () => {
    await service.createNote({
      title: "Tags",
      content: "",
      tags: ["  #School  ", "WORK", "work", "", "My  Tag"],
    })

    expect(storedNotes()[0].tags).toEqual(["school", "work", "my tag"])
  })

  it("rejects invalid tags with a ValidationError before writing", async () => {
    await expect(
      service.createNote({ title: "x", content: "", tags: ["a,b"] }),
    ).rejects.toThrow(ValidationError)

    expect(storage.getItem(NOTES_STORAGE_KEY)).toBeNull()
  })

  it("allows an empty title", async () => {
    const note = await service.createNote({
      title: "",
      content: "",
      tags: [],
    })

    expect(note.title).toBe("")
  })

  it("propagates repository errors", async () => {
    corruptStorage()

    await expect(
      service.createNote({ title: "x", content: "", tags: [] }),
    ).rejects.toThrow(NotesStorageError)
  })
})

describe("NotesService updateNote", () => {
  it("applies a field-scoped patch and leaves other fields alone", async () => {
    const created = await service.createNote({
      title: "Original",
      content: "Body",
      tags: ["school"],
    })

    const updated = await service.updateNote(created.id, { title: "Renamed" })

    expect(updated.title).toBe("Renamed")
    expect(updated.content).toBe("Body")
    expect(updated.tags).toEqual(["school"])
  })

  it("normalizes tags in a patch", async () => {
    const created = await service.createNote({
      title: "Tags",
      content: "",
      tags: [],
    })

    const updated = await service.updateNote(created.id, {
      tags: ["  #Work  ", "WORK"],
    })

    expect(updated.tags).toEqual(["work"])
    expect(storedNotes()[0].tags).toEqual(["work"])
  })

  it("does not touch tags when the patch omits them", async () => {
    const created = await service.createNote({
      title: "Tags",
      content: "",
      tags: ["school"],
    })

    const updated = await service.updateNote(created.id, { title: "Renamed" })

    expect(updated.tags).toEqual(["school"])
  })

  it("rejects an invalid tag patch with a ValidationError", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })

    await expect(
      service.updateNote(created.id, { tags: ["a,b"] }),
    ).rejects.toThrow(ValidationError)

    expect(storedNotes()[0].tags).toEqual([])
  })

  it("treats an empty patch as a no-op", async () => {
    const created = await service.createNote({
      title: "Original",
      content: "Body",
      tags: ["school"],
    })
    vi.setSystemTime(new Date(T1))

    const updated = await service.updateNote(created.id, {})

    expect(updated).toEqual(created)
    expect(updated.updatedAt).toBe(T0)
  })

  it("changes updatedAt for a title change", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })
    vi.setSystemTime(new Date(T1))

    const updated = await service.updateNote(created.id, { title: "Renamed" })

    expect(updated.updatedAt).toBe(T1)
    expect(updated.createdAt).toBe(T0)
  })

  it("does NOT change updatedAt for a pin-only patch", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })
    vi.setSystemTime(new Date(T1))

    const pinned = await service.updateNote(created.id, { isPinned: true })

    expect(pinned.isPinned).toBe(true)
    expect(pinned.updatedAt).toBe(T0)
  })

  it("propagates a missing-note error", async () => {
    await expect(
      service.updateNote("missing-id", { title: "x" }),
    ).rejects.toThrow(NoteNotFoundError)
  })

  it("propagates repository errors", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })
    corruptStorage()

    await expect(
      service.updateNote(created.id, { title: "Renamed" }),
    ).rejects.toThrow(NotesStorageError)
  })
})

describe("NotesService deleteNote", () => {
  it("removes the note", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })

    await service.deleteNote(created.id)

    await expect(service.getNotes()).resolves.toEqual([])
  })

  it("is idempotent", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })

    await service.deleteNote(created.id)
    await expect(service.deleteNote(created.id)).resolves.toBeUndefined()
  })

  it("propagates repository errors", async () => {
    corruptStorage()

    await expect(service.deleteNote("any")).rejects.toThrow(NotesStorageError)
  })
})

describe("NotesService togglePin", () => {
  it("pins an unpinned note", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })

    const pinned = await service.togglePin(created.id)

    expect(pinned.isPinned).toBe(true)
  })

  it("unpins a pinned note", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })
    await service.updateNote(created.id, { isPinned: true })

    const unpinned = await service.togglePin(created.id)

    expect(unpinned.isPinned).toBe(false)
  })

  it("does NOT change updatedAt", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })
    vi.setSystemTime(new Date(T1))

    const pinned = await service.togglePin(created.id)

    expect(pinned.updatedAt).toBe(T0)
    expect(pinned.createdAt).toBe(T0)
  })

  it("reads the authoritative stored state, not a cached value", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })
    const externallyPinned = [{ ...created, isPinned: true }]
    storage.setItem(NOTES_STORAGE_KEY, JSON.stringify(externallyPinned))

    const toggled = await service.togglePin(created.id)

    expect(toggled.isPinned).toBe(false)
  })

  it("persists the pin to storage", async () => {
    const created = await service.createNote({
      title: "x",
      content: "",
      tags: [],
    })

    await service.togglePin(created.id)

    expect(storedNotes()[0].isPinned).toBe(true)
  })

  it("throws NoteNotFoundError for a missing note", async () => {
    await expect(service.togglePin("missing-id")).rejects.toThrow(
      NoteNotFoundError,
    )
  })

  it("propagates repository errors", async () => {
    corruptStorage()

    await expect(service.togglePin("any")).rejects.toThrow(NotesStorageError)
  })
})

describe("NotesService reorderNotes", () => {
  it("reorders the notes through the repository", async () => {
    const first = await service.createNote({ title: "One", content: "", tags: [] })
    const second = await service.createNote({ title: "Two", content: "", tags: [] })

    await service.reorderNotes([second.id, first.id])

    expect((await service.getNotes()).map((note) => note.title)).toEqual([
      "Two",
      "One",
    ])
  })

  it("is a no-op for an unchanged order and writes nothing", async () => {
    const first = await service.createNote({ title: "One", content: "", tags: [] })
    const second = await service.createNote({ title: "Two", content: "", tags: [] })

    const before = JSON.stringify(
      storage.getItem(NOTES_STORAGE_KEY) ?? "",
    )
    const result = await service.reorderNotes([first.id, second.id])

    expect(JSON.stringify(storage.getItem(NOTES_STORAGE_KEY) ?? "")).toBe(before)
    expect(result.map((note) => note.title)).toEqual(["One", "Two"])
  })

  it("does not touch updatedAt", async () => {
    const first = await service.createNote({ title: "One", content: "", tags: [] })
    const second = await service.createNote({ title: "Two", content: "", tags: [] })

    await service.reorderNotes([second.id, first.id])

    const reloaded = await service.getNotes()

    expect(reloaded.find((note) => note.id === first.id)?.updatedAt).toBe(T0)
    expect(reloaded.find((note) => note.id === second.id)?.updatedAt).toBe(T0)
  })

  it("rejects a list that is not exactly the stored notes", async () => {
    const first = await service.createNote({ title: "One", content: "", tags: [] })

    await expect(service.reorderNotes([])).rejects.toThrow(ValidationError)
    await expect(
      service.reorderNotes([first.id, "missing"]),
    ).rejects.toThrow(ValidationError)
    await expect(
      service.reorderNotes([first.id, first.id]),
    ).rejects.toThrow(ValidationError)
  })

  it("propagates repository errors", async () => {
    corruptStorage()

    await expect(service.reorderNotes([])).rejects.toThrow(NotesStorageError)
  })
})

describe("NotesService getNotes", () => {
  it("returns an empty list when nothing is stored", async () => {
    await expect(service.getNotes()).resolves.toEqual([])
  })

  it("returns every stored note", async () => {
    await service.createNote({ title: "One", content: "", tags: [] })
    await service.createNote({ title: "Two", content: "", tags: [] })

    const notes = await service.getNotes()

    expect(notes).toHaveLength(2)
  })

  it("propagates repository errors", async () => {
    corruptStorage()

    await expect(service.getNotes()).rejects.toThrow(NotesStorageError)
  })
})