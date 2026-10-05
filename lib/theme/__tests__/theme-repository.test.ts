// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest"

import { THEME_STORAGE_KEY } from "@/lib/theme/theme-config"
import { LocalStorageThemeRepository } from "@/lib/theme/theme-repository"
import { readStoredTheme } from "@/lib/theme/theme-utils"

const NOTES_KEY = "notes-app.notes"
const SETTINGS_KEY = "notes-app.settings"

function seedEverything() {
  window.localStorage.setItem(NOTES_KEY, JSON.stringify([{ id: "note-1" }]))
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sortOrder: "updated" }))
}

function snapshotUnrelatedKeys() {
  return {
    notes: window.localStorage.getItem(NOTES_KEY),
    settings: window.localStorage.getItem(SETTINGS_KEY),
  }
}

afterEach(() => {
  window.localStorage.clear()
})

describe("theme persistence", () => {
  it("writes only to its own key", async () => {
    seedEverything()

    const before = snapshotUnrelatedKeys()
    const repository = new LocalStorageThemeRepository()

    await repository.save({
      colorMode: "dark",
      preset: "forest",
      accent: "#123456",
    })

    expect(snapshotUnrelatedKeys()).toEqual(before)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).not.toBeNull()
  })

  it("round trips a saved value", async () => {
    const repository = new LocalStorageThemeRepository()

    const saved = await repository.save({
      colorMode: "light",
      preset: "lavender",
      accent: "#ABC",
    })

    expect(saved).toEqual({
      colorMode: "light",
      preset: "lavender",
      accent: "#aabbcc",
    })
    expect(await repository.get()).toEqual(saved)
    expect(repository.getStored()).toEqual(saved)
  })

  it("stores the accent normalized rather than as entered", async () => {
    const repository = new LocalStorageThemeRepository()

    await repository.save({
      colorMode: "system",
      preset: "default",
      accent: " #Ff00Aa ",
    })

    const raw = window.localStorage.getItem(THEME_STORAGE_KEY) ?? ""

    expect(raw).toContain('"accent":"#ff00aa"')
  })

  it("reports defaults when nothing is stored", async () => {
    const repository = new LocalStorageThemeRepository()

    expect(await repository.get()).toEqual({
      colorMode: "system",
      preset: "default",
      accent: null,
    })
  })

  it("reports defaults for corrupted storage instead of throwing", () => {
    for (const raw of ["{not json", "null", "[]", '"dark"', '{"accent":5}']) {
      window.localStorage.setItem(THEME_STORAGE_KEY, raw)

      expect(readStoredTheme(), raw).toEqual({
        colorMode: "system",
        preset: "default",
        accent: null,
      })
    }
  })

  it("recovers a usable value from partially corrupted storage", () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "dark", preset: "unknown", accent: "nope" }),
    )

    expect(readStoredTheme()).toEqual({
      colorMode: "dark",
      preset: "default",
      accent: null,
    })
  })

  it("never stores an accent that is not a hex color", async () => {
    const repository = new LocalStorageThemeRepository()

    const saved = await repository.save({
      colorMode: "dark",
      preset: "paper",
      accent: "rgb(1, 2, 3)" as string,
    })

    expect(saved.accent).toBeNull()
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toContain(
      '"accent":null',
    )
  })

  it("can be cleared by saving the defaults", async () => {
    const repository = new LocalStorageThemeRepository()

    await repository.save({
      colorMode: "dark",
      preset: "forest",
      accent: "#123456",
    })
    await repository.save({
      colorMode: "system",
      preset: "default",
      accent: null,
    })

    expect(await repository.get()).toEqual({
      colorMode: "system",
      preset: "default",
      accent: null,
    })
  })
})