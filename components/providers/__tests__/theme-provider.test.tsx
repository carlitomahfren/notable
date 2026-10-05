// @vitest-environment jsdom

import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider, useTheme } from "@/components/providers/theme-provider"
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-config"
import { deriveAccentLift, deriveAccentLiftDark } from "@/lib/theme/theme-utils"
import {
  click,
  query,
  queryAll,
  render,
  unmountAll,
} from "@/components/notes/__tests__/test-render"

const NOTES_KEY = "notes-app.notes"

function ThemeProbe() {
  const theme = useTheme()

  return (
    <div>
      <span data-probe="mode">{theme.preferences.colorMode}</span>
      <span data-probe="preset">{theme.preferences.preset}</span>
      <span data-probe="accent">{theme.preferences.accent ?? "none"}</span>
      <span data-probe="resolved">{theme.resolvedMode}</span>
      <span data-probe="persistent">{String(theme.isPersistent)}</span>
      <span data-probe="hasCustom">{String(theme.hasCustomAccent)}</span>

      <button type="button" onClick={() => theme.setColorMode("dark")}>
        set dark
      </button>
      <button type="button" onClick={() => theme.setColorMode("system")}>
        set system
      </button>
      <button type="button" onClick={() => theme.setPreset("forest")}>
        set forest
      </button>
      <button type="button" onClick={() => theme.setAccent("#ff00aa")}>
        set accent
      </button>
      <button type="button" onClick={() => theme.setAccent("nonsense")}>
        set bad accent
      </button>
      <button type="button" onClick={theme.clearAccent}>
        clear accent
      </button>
      <button type="button" onClick={theme.reset}>
        reset
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  )
}

function probe(container: HTMLElement, name: string): string {
  return query(`[data-probe="${name}"]`, container)?.textContent ?? ""
}

function root() {
  return document.documentElement
}

function stored(): unknown {
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY)

  return raw === null ? null : JSON.parse(raw)
}

function installMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  const list = {
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      listeners.add(listener)
    },
    removeEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      listeners.delete(listener)
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }

  Object.defineProperty(window, "matchMedia", {
    value: () => list,
    configurable: true,
    writable: true,
  })

  return {
    get listenerCount() {
      return listeners.size
    },
    async set(next: boolean) {
      list.matches = next

      await act(async () => {
        for (const listener of listeners) {
          listener({ matches: next } as MediaQueryListEvent)
        }
      })
    },
  }
}

beforeEach(() => {
  window.localStorage.clear()

  root().removeAttribute("data-color-scheme")
  root().removeAttribute("data-preset")
  root().removeAttribute("style")
})

afterEach(async () => {
  await unmountAll()

  window.localStorage.clear()
  Reflect.deleteProperty(window, "matchMedia")
  vi.restoreAllMocks()
})

describe("first render", () => {
  it("applies the stored theme to the document immediately", async () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "dark", preset: "paper", accent: null }),
    )

    await renderProbe()

    expect(root().getAttribute("data-color-scheme")).toBe("dark")
    expect(root().getAttribute("data-preset")).toBe("paper")
  })

  it("falls back to the default theme when storage is unusable", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "{not json")

    await renderProbe()

    expect(root().getAttribute("data-color-scheme")).toBe("system")
    expect(root().getAttribute("data-preset")).toBe("default")
  })

  it("renders on the server without touching storage", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("localStorage must not be read during server rendering")
      })

    expect(() =>
      renderToStaticMarkup(
        <ThemeProvider>
          <ThemeProbe />
        </ThemeProvider>,
      ),
    ).not.toThrow()

    getItem.mockRestore()
  })
})

/*
 * A hydration mismatch is not a cosmetic warning: React discards the server
 * markup for the mismatched subtree, so the fix has to make the two first renders
 * genuinely identical rather than silencing the report.
 */
describe("hydration", () => {
  function ThemeDependentTree() {
    return (
      <ThemeProvider>
        <ThemeSwitchProbe />
      </ThemeProvider>
    )
  }

  function ThemeSwitchProbe() {
    const theme = useTheme()

    return (
      <button
        type="button"
        role="switch"
        aria-checked={theme.resolvedMode === "dark"}
      >
        Dark mode
      </button>
    )
  }

  /** Every value this component rendered, in order. */
  function createRenderLog() {
    const modes: string[] = []

    return {
      modes,
      Probe() {
        const theme = useTheme()

        modes.push(theme.resolvedMode)

        return (
          <button
            type="button"
            role="switch"
            aria-checked={theme.resolvedMode === "dark"}
          >
            Dark mode
          </button>
        )
      },
    }
  }

  function storeDark() {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "dark", preset: "forest", accent: "#123456" }),
    )
  }

  it("renders the same first value whatever storage holds", async () => {
    storeDark()

    const log = createRenderLog()

    await render(
      <ThemeProvider>
        <log.Probe />
      </ThemeProvider>,
    )

    /*
     * The server has no storage and no operating system to read, so it can only
     * ever resolve to light. If the first client render resolved to anything else,
     * the two trees would differ and React would report a mismatch.
     */
    expect(log.modes[0]).toBe("light")
  })

  it("adopts the stored theme before anything is painted", async () => {
    storeDark()

    const container = await render(
      <ThemeProvider>
        <ThemeDependentTree />
      </ThemeProvider>,
    )

    /*
     * `useLayoutEffect` runs before paint, so by the time anything is on screen
     * the correct state is already showing. A passive effect would paint the light
     * theme first, which is the flash the bootstrap script exists to prevent.
     */
    expect(
      query('[role="switch"]', container)?.getAttribute("aria-checked"),
    ).toBe("true")
    expect(root().getAttribute("data-color-scheme")).toBe("dark")
    expect(root().getAttribute("data-preset")).toBe("forest")
  })

  it("raises no hydration error against markup a server could have sent", async () => {
    storeDark()

    /*
     * Hand-written rather than produced by `renderToStaticMarkup`: under jsdom a
     * `window` exists, so that helper would read storage and produce exactly what
     * the client produces, which is the mismatch this test exists to rule out.
     */
    const sentByServer =
      '<button type="button" role="switch" aria-checked="false">Dark mode</button>'

    const recoverable: unknown[] = []
    const consoleErrors = vi.spyOn(console, "error").mockImplementation(() => {})
    const host = document.createElement("div")

    host.innerHTML = sentByServer
    document.body.append(host)

    let root: ReturnType<typeof hydrateRoot> | null = null

    await act(async () => {
      root = hydrateRoot(host, <ThemeDependentTree />, {
        onRecoverableError: (error) => recoverable.push(error),
      })
    })

    expect(recoverable).toEqual([])
    expect(
      consoleErrors.mock.calls.filter((call) =>
        /hydrat|did not match/i.test(call.map(String).join(" ")),
      ),
    ).toEqual([])

    // And the markup did end up corrected to the stored theme.
    expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe(
      "true",
    )

    consoleErrors.mockRestore()

    await act(async () => {
      root?.unmount()
    })

    host.remove()
  })
})

describe("changing the theme", () => {
  it("persists the selected color mode", async () => {
    const container = await renderProbe()

    await click(queryAll("button", container)[0])

    expect(probe(container, "mode")).toBe("dark")
    expect(root().getAttribute("data-color-scheme")).toBe("dark")
    expect(stored()).toEqual({
      colorMode: "dark",
      preset: "default",
      accent: null,
    })
  })

  it("persists the selected preset", async () => {
    const container = await renderProbe()

    await click(queryAll("button", container)[2])

    expect(probe(container, "preset")).toBe("forest")
    expect(root().getAttribute("data-preset")).toBe("forest")
    expect(stored()).toMatchObject({ preset: "forest" })
  })

  it("persists a custom accent and exposes it as an inline variable", async () => {
    const container = await renderProbe()

    await click(queryAll("button", container)[3])

    expect(probe(container, "accent")).toBe("#ff00aa")
    expect(probe(container, "hasCustom")).toBe("true")
    expect(root().style.getPropertyValue("--accent")).toBe("#ff00aa")
    expect(root().style.getPropertyValue("--accent-lift")).toBe(
      deriveAccentLift("#ff00aa"),
    )
    expect(root().style.getPropertyValue("--accent-lift-dark")).toBe(
      deriveAccentLiftDark("#ff00aa"),
    )
  })

  it("removes the inline accent when the preset accent is restored", async () => {
    const container = await renderProbe()

    await click(queryAll("button", container)[3])
    expect(root().style.getPropertyValue("--accent")).not.toBe("")

    await click(queryAll("button", container)[5])

    expect(probe(container, "hasCustom")).toBe("false")
    expect(root().style.getPropertyValue("--accent")).toBe("")
    expect(root().style.getPropertyValue("--accent-lift")).toBe("")
    expect(root().style.getPropertyValue("--accent-lift-dark")).toBe("")
    expect(stored()).toMatchObject({ accent: null })
  })

  it("ignores an accent that is not a hex color", async () => {
    const container = await renderProbe()

    await click(queryAll("button", container)[4])

    expect(probe(container, "accent")).toBe("none")
    expect(root().style.getPropertyValue("--accent")).toBe("")
    expect(stored()).toBeNull()
  })

  it("resets every preference in one action", async () => {
    const container = await renderProbe()

    await click(queryAll("button", container)[0])
    await click(queryAll("button", container)[2])
    await click(queryAll("button", container)[3])
    await click(queryAll("button", container)[6])

    expect(probe(container, "mode")).toBe("system")
    expect(probe(container, "preset")).toBe("default")
    expect(probe(container, "accent")).toBe("none")
    expect(root().getAttribute("data-color-scheme")).toBe("system")
    expect(root().getAttribute("data-preset")).toBe("default")
    expect(stored()).toEqual({
      colorMode: "system",
      preset: "default",
      accent: null,
    })
  })

  it("keeps the custom accent when only the mode changes", async () => {
    const container = await renderProbe()

    await click(queryAll("button", container)[3])
    await click(queryAll("button", container)[0])

    expect(stored()).toMatchObject({
      colorMode: "dark",
      accent: "#ff00aa",
    })
  })
})

describe("storage failures", () => {
  it("reports a failed write without breaking the theme", async () => {
    const container = await renderProbe()

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded")
    })

    await click(queryAll("button", container)[2])

    expect(probe(container, "persistent")).toBe("false")
    expect(probe(container, "preset")).toBe("forest")
    expect(root().getAttribute("data-preset")).toBe("forest")
  })
})

describe("notes isolation", () => {
  it("never writes to the notes key", async () => {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify([{ id: "note-1" }]))

    const container = await renderProbe()

    await click(queryAll("button", container)[0])
    await click(queryAll("button", container)[2])
    await click(queryAll("button", container)[3])

    expect(window.localStorage.getItem(NOTES_KEY)).toBe(
      JSON.stringify([{ id: "note-1" }]),
    )
  })

  it("does not delete notes when the theme is reset", async () => {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify([{ id: "note-1" }]))

    const container = await renderProbe()

    await click(queryAll("button", container)[6])

    expect(window.localStorage.getItem(NOTES_KEY)).toBe(
      JSON.stringify([{ id: "note-1" }]),
    )
  })
})

describe("system color scheme", () => {
  it("resolves system mode from the operating system", async () => {
    installMatchMedia(true)

    const container = await renderProbe()

    expect(probe(container, "mode")).toBe("system")
    expect(probe(container, "resolved")).toBe("dark")
  })

  it("follows the operating system while in system mode", async () => {
    const media = installMatchMedia(false)

    const container = await renderProbe()

    expect(probe(container, "resolved")).toBe("light")
    expect(media.listenerCount).toBe(1)

    await media.set(true)

    expect(probe(container, "resolved")).toBe("dark")
  })

  it("ignores the operating system for an explicit mode", async () => {
    const media = installMatchMedia(false)

    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "dark", preset: "default", accent: null }),
    )

    const container = await renderProbe()

    expect(probe(container, "resolved")).toBe("dark")

    media.set(false)

    expect(probe(container, "resolved")).toBe("dark")
  })

  it("does not subscribe to the system while an explicit mode is chosen", async () => {
    const media = installMatchMedia(false)

    const container = await renderProbe()

    await click(queryAll("button", container)[0])

    expect(probe(container, "resolved")).toBe("dark")
    expect(media.listenerCount).toBe(0)
  })

  it("works when matchMedia is unavailable", async () => {
    const container = await renderProbe()

    expect(probe(container, "resolved")).toBe("light")
    expect(root().getAttribute("data-color-scheme")).toBe("system")
  })
})