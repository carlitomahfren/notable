// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme/theme-bootstrap"
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-config"
import {
  accentForeground,
  deriveAccentLift,
  deriveAccentLiftDark,
  normalizeHex,
} from "@/lib/theme/theme-utils"

const SEEDS = [
  "#000000",
  "#ffffff",
  "#3b5bdb",
  "#a4601f",
  "#1f6b45",
  "#6d4bc4",
  "#808080",
  "#ffff00",
  "#00ff00",
  "#123456",
  "#fedcba",
]

function runBootstrap() {
  // Executed as a plain function so the script runs exactly as it would in the
  // document head, with no module scope available to fall back on.
  new Function(THEME_BOOTSTRAP_SCRIPT)()
}

function root() {
  return document.documentElement
}

function inlineVariables(): Record<string, string> {
  return {
    accent: root().style.getPropertyValue("--accent"),
    foreground: root().style.getPropertyValue("--accent-foreground"),
    lift: root().style.getPropertyValue("--accent-lift"),
    liftDark: root().style.getPropertyValue("--accent-lift-dark"),
  }
}

beforeEach(() => {
  window.localStorage.clear()

  root().removeAttribute("data-color-scheme")
  root().removeAttribute("data-preset")
  root().removeAttribute("style")
})

afterEach(() => {
  window.localStorage.clear()
})

describe("root attributes", () => {
  it("marks the document as following the system in the default theme", () => {
    runBootstrap()

    expect(root().getAttribute("data-color-scheme")).toBe("system")
    expect(root().getAttribute("data-preset")).toBe("default")
  })

  it("applies a stored mode and preset", () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "dark", preset: "lavender", accent: null }),
    )

    runBootstrap()

    expect(root().getAttribute("data-color-scheme")).toBe("dark")
    expect(root().getAttribute("data-preset")).toBe("lavender")
  })

  it("falls back per field when a stored value is not recognized", () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "neon", preset: 42, accent: "#abcdef" }),
    )

    runBootstrap()

    expect(root().getAttribute("data-color-scheme")).toBe("system")
    expect(root().getAttribute("data-preset")).toBe("default")
    expect(inlineVariables().accent).toBe("#abcdef")
  })
})

describe("no flash behavior", () => {
  it("leaves the preset accents to the stylesheet when no accent is stored", () => {
    runBootstrap()

    expect(inlineVariables()).toEqual({
      accent: "",
      foreground: "",
      lift: "",
      liftDark: "",
    })
  })

  it("sets inline accent variables before React renders", () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "light", preset: "default", accent: "#3B5BDB" }),
    )

    runBootstrap()

    expect(inlineVariables().accent).toBe("#3b5bdb")
  })
})

describe("bootstrap and provider parity", () => {
  it("derives exactly the same accent tokens as the TypeScript utilities", () => {
    for (const seed of SEEDS) {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        JSON.stringify({ colorMode: "dark", preset: "default", accent: seed }),
      )

      runBootstrap()

      const normalized = normalizeHex(seed) as string

      expect(inlineVariables()).toEqual({
        accent: normalized,
        foreground: accentForeground(normalized),
        lift: deriveAccentLift(normalized),
        liftDark: deriveAccentLiftDark(normalized),
      })
    }
  })

  it("accepts shorthand hex the same way the provider does", () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ accent: "#AbC" }),
    )

    runBootstrap()

    expect(inlineVariables().accent).toBe("#aabbcc")
  })
})

describe("hostile stored data", () => {
  it("does not throw on malformed JSON", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "{not json")

    expect(runBootstrap).not.toThrow()
    expect(root().getAttribute("data-color-scheme")).toBe("system")
    expect(root().getAttribute("data-preset")).toBe("default")
  })

  it("does not throw when the stored value is not an object", () => {
    for (const raw of ["null", "[]", '"dark"', "7", "true"]) {
      window.localStorage.setItem(THEME_STORAGE_KEY, raw)

      expect(runBootstrap, raw).not.toThrow()
      expect(root().getAttribute("data-color-scheme"), raw).toBe("system")
    }
  })

  it("ignores accents that are not plain hex colors", () => {
    for (const accent of [
      "rgb(1, 2, 3)",
      "var(--accent)",
      "#1234",
      "red",
      "#gggggg",
    ]) {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ accent }))

      expect(runBootstrap, accent).not.toThrow()
      expect(inlineVariables().accent, accent).toBe("")
    }
  })

  it("ignores a non string accent", () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ accent: { toString: () => "#ffffff" } }),
    )

    runBootstrap()

    expect(inlineVariables().accent).toBe("")
  })

  it("still applies the theme when storage itself throws", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked")
    })

    expect(runBootstrap).not.toThrow()
    expect(root().getAttribute("data-color-scheme")).toBe("system")
    expect(root().getAttribute("data-preset")).toBe("default")

    getItem.mockRestore()
  })
})