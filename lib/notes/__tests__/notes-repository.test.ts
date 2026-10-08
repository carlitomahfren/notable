import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  LocalStorageNotesRepository,
  NOTES_STORAGE_KEY,
  NotesStorageError,
} from "@/lib/notes/notes-repository"
import { describeNotesRepositoryContract } from "./notes-repository-contract"
import {
  clearBrowserStub,
  createMemoryStorage,
  stubBrowser,
} from "./memory-storage"

let storage: Storage

function repository() {
  return new LocalStorageNotesRepository()
}

function writeRaw(value: string): void {
  storage.setItem(NOTES_STORAGE_KEY, value)
}

function readRaw(): string | null {
  return storage.getItem(NOTES_STORAGE_KEY)
}

const validNote = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Stored note",
  content: "Body",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  isPinned: false,
  order: 0,
  tags: ["school"],
}

beforeEach(() => {
  storage = createMemoryStorage()
  stubBrowser(storage)
})

afterEach(() => {
  clearBrowserStub()
})

describeNotesRepositoryContract("LocalStorageNotesRepository", {
  createRepository: repository,
  reset: () => {
    storage.clear()
  },
})

describe("LocalStorageNotesRepository persistence", () => {
  it("uses the namespaced storage key", () => {
    expect(NOTES_STORAGE_KEY).toBe("notes-app.notes")
  })

  it("writes notes as JSON to localStorage", async () => {
    const created = await repository().create({
      title: "Persisted",
      content: "Body",
      tags: [],
    })

    const raw = readRaw()
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toHaveLength(1)
    expect(JSON.parse(raw as string)[0].id).toBe(created.id)
  })

  it("reads notes back after a simulated reload", async () => {
    const created = await repository().create({
      title: "Survives reload",
      content: "Body",
      tags: ["work"],
    })

    const afterReload = await new LocalStorageNotesRepository().getById(created.id)

    expect(afterReload?.title).toBe("Survives reload")
    expect(afterReload?.tags).toEqual(["work"])
  })
})

describe("LocalStorageNotesRepository malformed storage", () => {
  it("returns an empty list when the key is absent", async () => {
    await expect(repository().getAll()).resolves.toEqual([])
  })

  it("accepts an empty JSON array", async () => {
    writeRaw("[]")

    await expect(repository().getAll()).resolves.toEqual([])
  })

  it("throws instead of returning [] for invalid JSON", async () => {
    writeRaw("{not json")

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("throws instead of returning [] for a non-array JSON value", async () => {
    writeRaw(JSON.stringify({ notes: [] }))

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("throws instead of returning [] for a null JSON value", async () => {
    writeRaw("null")

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("throws when an array element is not a valid note", async () => {
    writeRaw(JSON.stringify([{ foo: "bar" }]))

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("throws when a note is missing required fields", async () => {
    writeRaw(JSON.stringify([{ ...validNote, title: undefined }]))

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("throws when a note has an empty id", async () => {
    writeRaw(JSON.stringify([{ ...validNote, id: "" }]))

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("throws when a timestamp is not an ISO 8601 UTC string", async () => {
    writeRaw(JSON.stringify([{ ...validNote, createdAt: "2026-01-01" }]))

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("throws when a timestamp is not a string", async () => {
    writeRaw(JSON.stringify([{ ...validNote, updatedAt: 1767225600000 }]))

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("throws when isPinned is not a boolean", async () => {
    writeRaw(JSON.stringify([{ ...validNote, isPinned: "yes" }]))

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("throws when tags is not an array", async () => {
    writeRaw(JSON.stringify([{ ...validNote, tags: "school" }]))

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("throws when a tag is not a string", async () => {
    writeRaw(JSON.stringify([{ ...validNote, tags: ["school", 5] }]))

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
  })

  it("accepts a valid note with an empty tags array", async () => {
    writeRaw(JSON.stringify([{ ...validNote, tags: [] }]))

    const notes = await repository().getAll()

    expect(notes).toHaveLength(1)
    expect(notes[0].tags).toEqual([])
  })

  it("accepts an empty-string tag, since normalization is the service's job", async () => {
    writeRaw(JSON.stringify([{ ...validNote, tags: [""] }]))

    const notes = await repository().getAll()

    expect(notes[0].tags).toEqual([""])
  })

  it("does not overwrite corrupt data while reading", async () => {
    const corrupt = "{not json"
    writeRaw(corrupt)

    await expect(repository().getAll()).rejects.toThrow()

    expect(readRaw()).toBe(corrupt)
  })

  it("does not overwrite invalid notes while reading", async () => {
    const invalid = JSON.stringify([{ foo: "bar" }])
    writeRaw(invalid)

    await expect(repository().getAll()).rejects.toThrow()

    expect(readRaw()).toBe(invalid)
  })

  it("propagates storage errors through every method that reads", async () => {
    writeRaw("{not json")
    const subject = repository()

    await expect(subject.getAll()).rejects.toThrow(NotesStorageError)
    await expect(subject.getById("any")).rejects.toThrow(NotesStorageError)
    await expect(subject.update("any", { title: "x" })).rejects.toThrow(
      NotesStorageError,
    )
    await expect(subject.delete("any")).rejects.toThrow(NotesStorageError)
    await expect(
      subject.create({ title: "x", content: "y", tags: [] }),
    ).rejects.toThrow(NotesStorageError)
  })

  it("surfaces a write failure instead of silently dropping the change", async () => {
    const subject = repository()
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })

    await expect(
      subject.create({ title: "x", content: "y", tags: [] }),
    ).rejects.toThrow(NotesStorageError)
  })
})

describe("LocalStorageNotesRepository legacy storage", () => {
  const legacyNote = (overrides: Record<string, unknown> = {}) => {
    const note: Record<string, unknown> = { ...validNote }
    delete note.order

    return { ...note, ...overrides }
  }

  it("gives stored legacy notes the order their slots already hold", async () => {
    writeRaw(JSON.stringify([legacyNote({ title: "First" }), legacyNote({ title: "Second" })]))

    const notes = await repository().getAll()

    expect(notes.map((note) => note.order)).toEqual([0, 1])
    expect(notes.map((note) => note.title)).toEqual(["First", "Second"])
  })

  it("persists the migration so the next read is a plain read", async () => {
    writeRaw(JSON.stringify([legacyNote()]))

    await repository().getAll()

    for (const stored of JSON.parse(readRaw() as string) as Record<string, unknown>[]) {
      expect(typeof stored.order).toBe("number")
    }
  })

  it("still throws when a stored entry is neither current nor legacy", async () => {
    writeRaw(JSON.stringify([legacyNote(), { foo: "bar" }]))

    await expect(repository().getAll()).rejects.toThrow(NotesStorageError)
    expect(readRaw()).toBe(JSON.stringify([legacyNote(), { foo: "bar" }]))
  })
})

describe("LocalStorageNotesRepository outside a browser", () => {
  it("treats missing window as empty storage rather than crashing", async () => {
    clearBrowserStub()

    await expect(repository().getAll()).resolves.toEqual([])
  })
})