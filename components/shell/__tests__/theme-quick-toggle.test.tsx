// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotesShell } from "@/components/shell/notes-shell"
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-config"

import { click, query, queryAll, unmountAll } from "@/components/notes/__tests__/test-render"
import { clearStorage, renderWithProviders, seedStorage } from "@/components/notes/__tests__/test-harness"

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

function installMatchMedia(prefersDark: boolean) {
  const list = {
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }

  Object.defineProperty(window, "matchMedia", {
    value: () => list,
    configurable: true,
    writable: true,
  })
}

function stored(): Record<string, unknown> {
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY)

  return raw === null ? {} : (JSON.parse(raw) as Record<string, unknown>)
}

function quickToggle(root: ParentNode = document): HTMLButtonElement {
  const toggle = query<HTMLButtonElement>(".theme-quick-toggle", root)

  if (toggle === null) {
    throw new Error("theme quick toggle not found")
  }

  return toggle
}

beforeEach(async () => {
  clearStorage()
  navigation.pathname.value = "/notes"
  await seedStorage([])
})

afterEach(async () => {
  await unmountAll()

  clearStorage()
  Reflect.deleteProperty(window, "matchMedia")
  document.documentElement.removeAttribute("data-color-scheme")
  document.documentElement.removeAttribute("data-preset")
  document.documentElement.removeAttribute("style")
})

describe("theme quick toggle", () => {
  it("is a labelled switch whose name does not depend on stored state", async () => {
    installMatchMedia(false)
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    /*
     * Naming the state rather than the action keeps the accessible name constant,
     * so the server has nothing theme-dependent to get wrong on hydration.
     */
    const toggle = quickToggle()

    expect(toggle.getAttribute("role")).toBe("switch")
    expect(toggle.getAttribute("aria-label")).toBe("Dark mode")
  })

  it("reflects the effective mode when the preference still follows the system", async () => {
    installMatchMedia(true)
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(quickToggle().getAttribute("aria-checked")).toBe("true")
  })

  it("persists an explicit choice from the system default", async () => {
    installMatchMedia(false)
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(quickToggle())

    expect(stored()).toMatchObject({ colorMode: "dark" })
    expect(document.documentElement.dataset.colorScheme).toBe("dark")
  })

  it("switches back to light and stays there", async () => {
    installMatchMedia(false)
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(quickToggle())
    await click(quickToggle())

    expect(stored()).toMatchObject({ colorMode: "light" })
    expect(document.documentElement.dataset.colorScheme).toBe("light")
  })

  /*
   * Once the user has picked a side, the toggle must not fall back to following
   * the system again. Otherwise pressing it twice could land back where it
   * started and the button would look broken.
   */
  it("does not return to following the system after an explicit choice", async () => {
    installMatchMedia(true)
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(quickToggle())

    expect(stored()).toMatchObject({ colorMode: "light" })

    await click(quickToggle())

    expect(stored()).toMatchObject({ colorMode: "dark" })
  })

  it("resolves a stored system preference against the media query", async () => {
    installMatchMedia(true)
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "system", preset: "default", accent: null }),
    )

    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    // The document keeps the user's intent; the control reports what is on screen.
    expect(document.documentElement.dataset.colorScheme).toBe("system")
    expect(quickToggle().getAttribute("aria-checked")).toBe("true")
  })

  it("leaves the system preference alone and only writes the resolved side", async () => {
    installMatchMedia(false)
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "system", preset: "default", accent: null }),
    )

    await renderWithProviders(<NotesShell>{null}</NotesShell>)
    await click(quickToggle())

    expect(stored()).toMatchObject({ colorMode: "dark" })
  })

  it("toggles with the keyboard and exposes its state", async () => {
    installMatchMedia(false)
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(quickToggle().getAttribute("aria-checked")).toBe("false")

    quickToggle().focus()
    await click(quickToggle())

    expect(quickToggle().getAttribute("aria-checked")).toBe("true")
    expect(quickToggle().disabled).toBe(false)
  })

  it("does not disturb the notes store", async () => {
    installMatchMedia(false)
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const notesBefore = window.localStorage.getItem("notes-app.notes")

    await click(quickToggle())

    expect(window.localStorage.getItem("notes-app.notes")).toBe(notesBefore)
  })

  it("keeps a single toggle mounted so hydration cannot disagree", async () => {
    installMatchMedia(false)
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(queryAll(".theme-quick-toggle", document)).toHaveLength(1)
  })
})

/*
 * The overlapping-icon bug was structural rather than cosmetic.
 *
 * Both Sun and Moon used to sit inside the track while a 28px thumb travelled over
 * the top of them, so whichever icon the thumb reached was partly hidden. These
 * tests pin the arrangement that makes that impossible: the icons are siblings of
 * the track, not descendants, so the thumb has no icon to reach.
 */
describe("theme quick toggle geometry", () => {
  /** Writes the theme key directly; `seedStorage` only covers notes. */
  function storeTheme(preferences: { colorMode: string }) {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ preset: "default", accent: null, ...preferences }),
    )
  }

  async function renderToggle(prefersDark = false) {
    installMatchMedia(prefersDark)
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    return quickToggle()
  }

  it("keeps both icons outside the sliding track", async () => {
    await renderToggle()

    const track = query(".theme-quick-toggle__track", document)

    expect(track).not.toBeNull()
    expect(track?.querySelectorAll("svg")).toHaveLength(0)
  })

  it("gives the thumb a track of its own to travel within", async () => {
    await renderToggle()

    const thumb = query(".theme-quick-toggle__thumb", document)

    expect(thumb?.parentElement?.className).toBe("theme-quick-toggle__track")
  })

  it("marks the thumb as decorative, since the switch already carries the state", async () => {
    await renderToggle()

    expect(query(".theme-quick-toggle__track", document)?.closest("[aria-hidden]"))
      .not.toBeNull()
  })

  it("hides both icons from assistive technology", async () => {
    await renderToggle()

    const icons = queryAll(".theme-quick-toggle__icon", document)

    expect(icons).toHaveLength(2)

    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true")
    }
  })

  it("publishes the resolved mode for styling, including when following the system", async () => {
    storeTheme({ colorMode: "system" })

    await renderToggle(true)

    expect(quickToggle().dataset.mode).toBe("dark")
    expect(stored().colorMode).toBe("system")
  })

  it("offers only light and dark, never a way back to the system", async () => {
    await renderToggle()
    await click(quickToggle())
    await click(quickToggle())

    // Two presses cannot land on anything but the explicit mode it started from.
    expect(quickToggle().dataset.mode).toBe("light")
    expect(stored().colorMode).toBe("light")
  })

  it("pins the explicit opposite of what is on screen when it leaves the system", async () => {
    storeTheme({ colorMode: "system" })

    // The OS is in dark, so the one unambiguous reading of the first press is off.
    await renderToggle(true)
    await click(quickToggle())

    expect(stored().colorMode).toBe("light")
    expect(quickToggle().dataset.mode).toBe("light")
  })
})