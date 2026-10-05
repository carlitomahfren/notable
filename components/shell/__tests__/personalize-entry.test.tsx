// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotesShell } from "@/components/shell/notes-shell"
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-config"

import {
  byLabelText,
  click,
  query,
  queryAll,
  unmountAll,
} from "@/components/notes/__tests__/test-render"
import {
  clearStorage,
  renderWithProviders,
  seedStorage,
} from "@/components/notes/__tests__/test-harness"

const navigation = vi.hoisted(() => ({
  pathname: { value: "/notes" },
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname.value,
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

beforeEach(async () => {
  clearStorage()
  navigation.pathname.value = "/notes"
  await seedStorage([])
})

afterEach(async () => {
  await unmountAll()

  clearStorage()
  document.documentElement.removeAttribute("data-color-scheme")
  document.documentElement.removeAttribute("data-preset")
  document.documentElement.removeAttribute("style")
})

function personalizeDialog(
  root: ParentNode = document,
): HTMLDialogElement | null {
  return query<HTMLDialogElement>(".personalize-dialog", root)
}

function gearEntry(root: ParentNode = document): HTMLElement {
  const gear = byLabelText("Settings", root)

  if (gear === null) {
    throw new Error("settings entry not found")
  }

  return gear
}

function settingsEntry(root: ParentNode = document): HTMLElement {
  const match = queryAll<HTMLElement>(".shell-nav-button", root).find(
    (element) =>
      element.querySelector(".shell-nav-button__label")?.textContent?.trim() ===
      "Settings",
  )

  if (match === undefined) {
    throw new Error("bottom bar settings entry not found")
  }

  return match
}

describe("Personalize entry points", () => {
  /*
   * The desktop bar has a gear and the mobile bar has a labelled Settings
   * destination. Both stay mounted so CSS alone decides which is visible, which
   * means both must work without a viewport check.
   */
  it("offers the settings entry in both navigation bars", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(gearEntry()).not.toBeNull()
    expect(settingsEntry()).not.toBeNull()
  })

  it("keeps both entries free of theme state so hydration cannot disagree", async () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "dark", preset: "forest", accent: "#123456" }),
    )

    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    /*
     * Neither label may describe the active theme: the server cannot know what is
     * in storage, so a label built from it would mismatch on hydration.
     */
    expect(gearEntry(container).getAttribute("aria-label")).toBe("Settings")
    expect(settingsEntry(container).textContent?.trim()).toBe("Settings")
  })

  it("opens Personalize from the desktop gear", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    // The empty dialog shell is always present; its contents mount on open.
    expect(personalizeDialog(container)?.textContent?.trim()).toBe("")

    await click(gearEntry(container))

    expect(personalizeDialog(container)?.textContent).toContain("Personalize")
  })

  it("opens Personalize from the mobile settings destination", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(settingsEntry(container))

    expect(personalizeDialog(container)?.textContent).toContain("Personalize")
  })

  /*
   * Personalize is the only settings surface, so it is reached directly. There
   * is no intermediate screen, which also means there is never a second modal
   * stacked on top of it.
   */
  it("is the only dialog in the shell while it is open", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(gearEntry(container))

    expect(queryAll<HTMLDialogElement>("dialog", container)).toHaveLength(1)
  })

  it("changes the theme from inside the shell", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(gearEntry(container))

    const preset = queryAll<HTMLInputElement>(
      'input[name="personalize-preset"]',
      container,
    )[2]

    await click(preset)

    expect(
      JSON.parse(window.localStorage.getItem(THEME_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({ preset: "forest" })
  })

  it("leaves notes untouched when the theme changes", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const notesBefore = window.localStorage.getItem("notes-app.notes")

    await click(gearEntry(container))
    await click(
      queryAll<HTMLInputElement>('input[name="personalize-preset"]', container)[1],
    )

    expect(window.localStorage.getItem("notes-app.notes")).toBe(notesBefore)
  })

  it("returns focus to the note list when the dialog closes", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(gearEntry(container))

    const done = queryAll<HTMLElement>(".personalize-dialog__primary", container)[0]

    await click(done)

    /*
     * The dialog is opened from the top bar, which stays mounted, so focus could
     * return to the trigger. It is parked on the list instead, which is where a
     * keyboard user carrying on with notes expects to be.
     */
    expect(document.activeElement).toBe(
      query(".shell-pane__focus-target", container),
    )
  })
})