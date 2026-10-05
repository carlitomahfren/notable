import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createMemoryStorage, clearBrowserStub, stubBrowser } from "@/lib/notes/__tests__/memory-storage"
import { NotesService } from "@/lib/notes/notes-service"
import { LocalStorageNotesRepository } from "@/lib/notes/notes-repository"
import {
  LocalStorageSettingsRepository,
  SETTINGS_STORAGE_KEY,
} from "@/lib/settings/settings-repository"
import { ensureWelcomeNotes, WELCOME_NOTES } from "@/lib/notes/welcome-notes"

let storage: Storage

beforeEach(() => {
  storage = createMemoryStorage()
  stubBrowser(storage)
})

afterEach(() => {
  clearBrowserStub()
})

function createStack() {
  const repository = new LocalStorageNotesRepository()
  const settings = new LocalStorageSettingsRepository()

  return { repository, settings, service: new NotesService(repository) }
}

describe("LocalStorageSettingsRepository", () => {
  it("returns defaults when nothing is stored", async () => {
    const settings = new LocalStorageSettingsRepository()

    await expect(settings.get()).resolves.toEqual({
      welcomeNotesSeeded: false,
    })
  })

  it("persists and reads back the seed flag", async () => {
    const settings = new LocalStorageSettingsRepository()

    await settings.save({ welcomeNotesSeeded: true })

    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify({ welcomeNotesSeeded: true }),
    )
    await expect(settings.get()).resolves.toEqual({
      welcomeNotesSeeded: true,
    })
  })

  it("falls back to defaults for malformed stored settings", async () => {
    storage.setItem(SETTINGS_STORAGE_KEY, "not json")

    const settings = new LocalStorageSettingsRepository()

    await expect(settings.get()).resolves.toEqual({
      welcomeNotesSeeded: false,
    })
  })

  it("ignores a non-boolean seed flag", async () => {
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ welcomeNotesSeeded: "yes" }),
    )

    const settings = new LocalStorageSettingsRepository()

    await expect(settings.get()).resolves.toEqual({
      welcomeNotesSeeded: false,
    })
  })

  it("stores settings separately from notes", async () => {
    const settings = new LocalStorageSettingsRepository()

    await settings.save({ welcomeNotesSeeded: true })

    expect(storage.getItem("notes-app.notes")).toBeNull()
  })
})

describe("ensureWelcomeNotes", () => {
  it("seeds every welcome note on first run", async () => {
    const { service, settings } = createStack()

    const created = await ensureWelcomeNotes(service, settings)

    expect(created).toHaveLength(WELCOME_NOTES.length)
    await expect(service.getNotes()).resolves.toHaveLength(
      WELCOME_NOTES.length,
    )
  })

  it("persists the seed flag", async () => {
    const { service, settings } = createStack()

    await ensureWelcomeNotes(service, settings)

    await expect(settings.get()).resolves.toEqual({
      welcomeNotesSeeded: true,
    })
  })

  it("normalizes seeded tags through the service boundary", async () => {
    const { service, settings } = createStack()

    await ensureWelcomeNotes(service, settings)

    const notes = await service.getNotes()

    for (const note of notes) {
      expect(note.tags.every((tag) => tag === tag.trim().toLowerCase())).toBe(true)
    }
  })

  it("pins the welcome note that requests pinning", async () => {
    const { service, settings } = createStack()

    await ensureWelcomeNotes(service, settings)

    const notes = await service.getNotes()

    expect(notes.some((note) => note.isPinned)).toBe(true)
  })

  it("does not seed again on a second call", async () => {
    const { service, settings } = createStack()

    await ensureWelcomeNotes(service, settings)
    const second = await ensureWelcomeNotes(service, settings)

    expect(second).toEqual([])
    await expect(service.getNotes()).resolves.toHaveLength(
      WELCOME_NOTES.length,
    )
  })

  it("does not seed again after a reload with the same storage", async () => {
    const { service, settings } = createStack()

    await ensureWelcomeNotes(service, settings)

    // Simulate a page reload by constructing fresh instances over the
    // same browser storage.
    const reloaded = createStack()

    await expect(
      ensureWelcomeNotes(reloaded.service, reloaded.settings),
    ).resolves.toEqual([])
    await expect(reloaded.service.getNotes()).resolves.toHaveLength(
      WELCOME_NOTES.length,
    )
  })

  it("does not reseed after the user deletes every note", async () => {
    const { service, settings } = createStack()

    await ensureWelcomeNotes(service, settings)

    for (const note of await service.getNotes()) {
      await service.deleteNote(note.id)
    }

    await expect(service.getNotes()).resolves.toEqual([])

    const reloaded = createStack()
    const created = await ensureWelcomeNotes(reloaded.service, reloaded.settings)

    expect(created).toEqual([])
    await expect(reloaded.service.getNotes()).resolves.toEqual([])
  })

  it("still seeds when notes exist but the flag was never set", async () => {
    const { service, settings } = createStack()

    await service.createNote({ title: "Mine", content: "", tags: [] })

    await ensureWelcomeNotes(service, settings)

    await expect(service.getNotes()).resolves.toHaveLength(
      WELCOME_NOTES.length + 1,
    )
  })

  it("marks the flag as seeded even when note creation fails", async () => {
    const { repository, settings } = createStack()
    const service = new NotesService(repository)
    const failing = {
      createNote: () => Promise.reject(new Error("storage unavailable")),
      togglePin: service.togglePin.bind(service),
    }

    await expect(
      ensureWelcomeNotes(failing as unknown as NotesService, settings),
    ).rejects.toThrow("storage unavailable")

    await expect(settings.get()).resolves.toEqual({
      welcomeNotesSeeded: true,
    })
  })

  it("reads settings safely when no browser is present", async () => {
    // Reads can be reached during server rendering, so they must degrade to
    // defaults. Writes only ever happen from client effects.
    clearBrowserStub()

    const settings = new LocalStorageSettingsRepository()

    await expect(settings.get()).resolves.toEqual({
      welcomeNotesSeeded: false,
    })
  })

  it("starts unseeded with no notes in brand new storage", async () => {
    const { service, settings } = createStack()

    await expect(settings.get()).resolves.toEqual({
      welcomeNotesSeeded: false,
    })
    await expect(service.getNotes()).resolves.toEqual([])
  })
})