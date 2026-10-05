import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
  COLOR_MODES,
  DEFAULT_THEME_PREFERENCES,
  PRESET_PALETTES,
  THEME_PRESETS,
  type ColorMode,
  type ThemePreset,
} from "@/lib/theme/theme-config"
import {
  accentForeground,
  coerceThemePreferences,
  contrastRatio,
  deriveAccentLift,
  deriveAccentLiftDark,
  mixHex,
  normalizeHex,
  readStoredTheme,
  relativeLuminance,
  resolveAccentTokens,
} from "@/lib/theme/theme-utils"

const MIN_TEXT_CONTRAST = 4.5

/**
 * Read once at module scope so both the palette and stylesheet checks can
 * assert against the real file.
 */
const stylesheet = readFileSync(
  fileURLToPath(new URL("../../../app/globals.css", import.meta.url)),
  "utf8",
)

/**
 * A spread of seeds that covers both ends of the lightness range, including
 * colors that need no adjustment and colors that need a lot.
 */
const SEEDS = [
  "#000000",
  "#ffffff",
  "#3b5bdb",
  "#a4601f",
  "#1f6b45",
  "#6d4bc4",
  "#808080",
  "#7f7f7f",
  "#ffff00",
  "#00ff00",
  "#123456",
  "#fedcba",
]

function everyMode(callback: (mode: "light" | "dark") => void) {
  callback("light")
  callback("dark")
}

describe("normalizeHex", () => {
  it("expands three digit shorthand", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc")
    expect(normalizeHex("abc")).toBe("#aabbcc")
  })

  it("lowercases six digit values with or without a hash", () => {
    expect(normalizeHex("#A1B2C3")).toBe("#a1b2c3")
    expect(normalizeHex("A1B2C3")).toBe("#a1b2c3")
  })

  it("tolerates surrounding whitespace", () => {
    expect(normalizeHex("  #a1b2c3  ")).toBe("#a1b2c3")
  })

  it("rejects anything that is not a plain hex color", () => {
    for (const value of [
      "",
      "#",
      "#12",
      "#1234",
      "#12345",
      "#1234567",
      "#12345678",
      "rgb(1, 2, 3)",
      "hsl(1 2% 3%)",
      "red",
      "#gggggg",
      "#a1b2c3;",
      null,
      undefined,
      42,
      {},
      [],
    ]) {
      expect(normalizeHex(value), `for ${JSON.stringify(value)}`).toBeNull()
    }
  })

  it("always returns the canonical seven character form", () => {
    for (const seed of SEEDS) {
      expect(normalizeHex(seed)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe("contrast helpers", () => {
  it("computes the maximum ratio for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5)
  })

  it("computes the minimum ratio for identical colors", () => {
    expect(contrastRatio("#3b5bdb", "#3b5bdb")).toBeCloseTo(1, 5)
  })

  it("is symmetric", () => {
    expect(contrastRatio("#3b5bdb", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#3b5bdb"),
      10,
    )
  })

  it("orders luminance from dark to light", () => {
    expect(relativeLuminance("#000000")).toBeLessThan(
      relativeLuminance("#3b5bdb"),
    )
    expect(relativeLuminance("#3b5bdb")).toBeLessThan(
      relativeLuminance("#ffffff"),
    )
  })

  it("mixes from one endpoint to the other", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000")
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff")
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080")
  })

  it("clamps out of range amounts", () => {
    expect(mixHex("#000000", "#ffffff", -5)).toBe("#000000")
    expect(mixHex("#000000", "#ffffff", 5)).toBe("#ffffff")
  })
})

describe("accentForeground", () => {
  it("chooses the candidate with the higher contrast", () => {
    for (const seed of SEEDS) {
      const foreground = accentForeground(seed)

      expect(["#ffffff", "#111111"]).toContain(foreground)
      expect(contrastRatio(seed, foreground)).toBeGreaterThanOrEqual(
        contrastRatio(seed, foreground === "#ffffff" ? "#111111" : "#ffffff"),
      )
    }
  })

  it("keeps text readable on every authored preset accent", () => {
    for (const preset of THEME_PRESETS) {
      everyMode((mode) => {
        const accent = PRESET_PALETTES[preset].accent[mode]

        expect(contrastRatio(accent, accentForeground(accent))).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        )
      })
    }
  })
})

describe("custom accent derivation", () => {
  it("returns the seed untouched when it already passes", () => {
    expect(deriveAccentLift("#000000")).toBe("#000000")
    expect(deriveAccentLiftDark("#ffffff")).toBe("#ffffff")
  })

  it("always produces a light lift that is readable on a light canvas", () => {
    for (const seed of SEEDS) {
      expect(contrastRatio(deriveAccentLift(seed), "#ffffff")).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      )
    }
  })

  it("always produces a dark lift that is readable on a dark canvas", () => {
    for (const seed of SEEDS) {
      expect(contrastRatio(deriveAccentLiftDark(seed), "#202020")).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      )
    }
  })

  it("only moves as far as needed, preserving hue", () => {
    // A mid blue already passes on white, so it is returned unchanged.
    expect(deriveAccentLift("#3b5bdb")).toBe("#3b5bdb")

    // Pure yellow fails badly on white and must be darkened substantially.
    expect(deriveAccentLift("#ffff00")).not.toBe("#ffff00")
    expect(relativeLuminance(deriveAccentLift("#ffff00"))).toBeLessThan(
      relativeLuminance("#ffff00"),
    )
  })

  it("never returns an unusable value", () => {
    for (const seed of SEEDS) {
      expect(normalizeHex(deriveAccentLift(seed))).not.toBeNull()
      expect(normalizeHex(deriveAccentLiftDark(seed))).not.toBeNull()
    }
  })
})

describe("preset palettes", () => {
  const CANVASES: Record<ThemePreset, Record<"light" | "dark", string>> = {
    default: { light: "#ffffff", dark: "#0e1014" },
    paper: { light: "#faf6ee", dark: "#17140f" },
    forest: { light: "#f2f7f3", dark: "#0b1310" },
    lavender: { light: "#f7f5fc", dark: "#100e18" },
  }

  const FOREGROUNDS: Record<ThemePreset, Record<"light" | "dark", string>> = {
    default: { light: "#16181d", dark: "#e7e9ee" },
    paper: { light: "#2a241c", dark: "#efe7d9" },
    forest: { light: "#14261b", dark: "#e2efe7" },
    lavender: { light: "#221c33", dark: "#ece8f7" },
  }

  const MUTED: Record<ThemePreset, Record<"light" | "dark", string>> = {
    default: { light: "#5b6270", dark: "#a2a9b8" },
    paper: { light: "#6b6053", dark: "#b3a894" },
    forest: { light: "#4c6155", dark: "#9cb3a5" },
    lavender: { light: "#5f5675", dark: "#a89fc0" },
  }

  it("defines exactly the four approved presets", () => {
    expect(THEME_PRESETS).toEqual(["default", "paper", "forest", "lavender"])
  })

  it("defines exactly the three approved color modes", () => {
    expect(COLOR_MODES).toEqual(["system", "light", "dark"])
  })

  it("keeps body text above the minimum ratio in every preset and mode", () => {
    for (const preset of THEME_PRESETS) {
      everyMode((mode) => {
        expect(
          contrastRatio(FOREGROUNDS[preset][mode], CANVASES[preset][mode]),
          `${preset} ${mode} foreground`,
        ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      })
    }
  })

  it("keeps secondary text above the minimum ratio in every preset and mode", () => {
    for (const preset of THEME_PRESETS) {
      everyMode((mode) => {
        expect(
          contrastRatio(MUTED[preset][mode], CANVASES[preset][mode]),
          `${preset} ${mode} muted foreground`,
        ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      })
    }
  })

  it("keeps secondary text readable on raised surfaces too", () => {
    // Placeholders and dialog hints sit on `--surface`, not on `--background`,
    // so the muted token has to hold up on both canvases.
    const SURFACES: Record<ThemePreset, Record<"light" | "dark", string>> = {
      default: { light: "#ffffff", dark: "#16191f" },
      paper: { light: "#f2ece0", dark: "#221c15" },
      forest: { light: "#e6efe8", dark: "#111a15" },
      lavender: { light: "#ece8f7", dark: "#1a1630" },
    }

    for (const preset of THEME_PRESETS) {
      everyMode((mode) => {
        expect(
          contrastRatio(MUTED[preset][mode], SURFACES[preset][mode]),
          `${preset} ${mode} muted on surface`,
        ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      })
    }
  })

  it("keeps the lifted accent readable on its own canvas", () => {
    for (const preset of THEME_PRESETS) {
      everyMode((mode) => {
        expect(
          contrastRatio(
            PRESET_PALETTES[preset].accentLift[mode],
            CANVASES[preset][mode],
          ),
          `${preset} ${mode} accent lift`,
        ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      })
    }
  })

  it("keeps the hover surface readable under its mode-based text color", () => {
    // The primary button hover paints the lift and switches to white text in
    // light mode and near-black in dark mode, so both pairings are checked.
    for (const preset of THEME_PRESETS) {
      const light = PRESET_PALETTES[preset].accentLift.light
      const dark = PRESET_PALETTES[preset].accentLift.dark

      expect(contrastRatio(light, "#ffffff"), `${preset} light hover`).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      )
      expect(contrastRatio(dark, "#111111"), `${preset} dark hover`).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      )
    }
  })

  it("keeps the same pairings readable for a custom accent", () => {
    for (const seed of SEEDS) {
      expect(
        contrastRatio(deriveAccentLift(seed), "#ffffff"),
        `${seed} light hover`,
      ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)

      expect(
        contrastRatio(deriveAccentLiftDark(seed), "#111111"),
        `${seed} dark hover`,
      ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    }
  })

  it("keeps the destructive confirm button readable in both modes", () => {
    // Mirrors `--destructive` and `--destructive-foreground` in the stylesheet,
    // which are only defined there.
    expect(contrastRatio("#b4232c", "#ffffff")).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    )
    expect(contrastRatio("#f97066", "#2a0a08")).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    )
  })

  it("keeps the focus ring visible against both canvases", () => {
    expect(stylesheet).toContain("--focus-ring: light-dark(#1b1e24, #f4f6fa)")
    expect(contrastRatio("#1b1e24", "#ffffff")).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    )
    expect(contrastRatio("#f4f6fa", "#0e1014")).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    )
  })

  it("keeps the accent surface readable under its own foreground", () => {
    for (const preset of THEME_PRESETS) {
      everyMode((mode) => {
        const accent = PRESET_PALETTES[preset].accent[mode]

        expect(contrastRatio(accent, accentForeground(accent))).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        )
      })
    }
  })
})

describe("resolveAccentTokens", () => {
  it("uses the authored palette when no custom accent is set", () => {
    const tokens = resolveAccentTokens(null, "forest", "dark")

    expect(tokens.accent).toBe(PRESET_PALETTES.forest.accent.dark)
    expect(tokens.accentLift).toBe(PRESET_PALETTES.forest.accentLift.dark)
  })

  it("keeps the custom seed as the accent surface", () => {
    expect(resolveAccentTokens("#ff00aa", "default", "light").accent).toBe("#ff00aa")
  })

  it("derives both lifts from a custom seed", () => {
    const tokens = resolveAccentTokens("#ffff00", "default", "light")

    expect(tokens.accentLift).toBe(deriveAccentLift("#ffff00"))
    expect(tokens.accentLiftDark).toBe(deriveAccentLiftDark("#ffff00"))
  })

  it("ignores an unusable accent and falls back to the preset", () => {
    const tokens = resolveAccentTokens("not-a-color", "paper", "light")

    expect(tokens.accent).toBe(PRESET_PALETTES.paper.accent.light)
  })

  it("keeps a custom accent readable in both modes", () => {
    for (const seed of SEEDS) {
      const light = resolveAccentTokens(seed, "default", "light")
      const dark = resolveAccentTokens(seed, "default", "dark")

      expect(contrastRatio(light.accentLift, "#ffffff")).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      )
      expect(contrastRatio(dark.accentLiftDark, "#202020")).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      )
      expect(contrastRatio(light.accent, light.accentForeground)).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      )
    }
  })
})

describe("coerceThemePreferences", () => {
  it("returns the defaults when there is nothing stored", () => {
    expect(coerceThemePreferences(undefined)).toEqual(DEFAULT_THEME_PREFERENCES)
    expect(coerceThemePreferences(null)).toEqual(DEFAULT_THEME_PREFERENCES)
    expect(coerceThemePreferences("dark")).toEqual(DEFAULT_THEME_PREFERENCES)
    expect(coerceThemePreferences([])).toEqual(DEFAULT_THEME_PREFERENCES)
    expect(coerceThemePreferences(7)).toEqual(DEFAULT_THEME_PREFERENCES)
  })

  it("defaults to system mode with no accent", () => {
    expect(DEFAULT_THEME_PREFERENCES).toEqual({
      colorMode: "system",
      preset: "default",
      accent: null,
    })
  })

  it("keeps a fully valid stored value", () => {
    const stored = { colorMode: "dark", preset: "forest", accent: "#a1b2c3" }

    expect(coerceThemePreferences(stored)).toEqual(stored)
  })

  it("falls back per field instead of discarding everything", () => {
    expect(
      coerceThemePreferences({
        colorMode: "nope",
        preset: "forest",
        accent: "#a1b2c3",
      }),
    ).toEqual({ colorMode: "system", preset: "forest", accent: "#a1b2c3" })

    expect(
      coerceThemePreferences({
        colorMode: "light",
        preset: "neon",
        accent: "zzz",
      }),
    ).toEqual({ colorMode: "light", preset: "default", accent: null })
  })

  it("normalizes a shorthand accent while reading", () => {
    expect(coerceThemePreferences({ accent: "#ABC" }).accent).toBe("#aabbcc")
  })

  it("treats a missing accent as no accent", () => {
    expect(coerceThemePreferences({ accent: undefined }).accent).toBeNull()
    expect(coerceThemePreferences({}).accent).toBeNull()
  })

  it("accepts only the approved enum members", () => {
    for (const mode of COLOR_MODES) {
      expect(coerceThemePreferences({ colorMode: mode }).colorMode).toBe(
        mode as ColorMode,
      )
    }

    for (const preset of THEME_PRESETS) {
      expect(coerceThemePreferences({ preset }).preset).toBe(preset as ThemePreset)
    }
  })
})

describe("storage boundary without a browser", () => {
  it("reports defaults instead of throwing", () => {
    expect(readStoredTheme()).toEqual(DEFAULT_THEME_PREFERENCES)
  })
})

describe("stylesheet parity", () => {
  it("keeps the CSS palette in step with the TypeScript palette", () => {
    for (const preset of THEME_PRESETS) {
      const palette = PRESET_PALETTES[preset]

      for (const value of [
        ...Object.values(palette.accent),
        ...Object.values(palette.accentLift),
      ]) {
        expect(stylesheet, `${preset} ${value}`).toContain(value)
      }
    }
  })

  it("does not hardcode colors in component rules", () => {
    const rules = stylesheet.split("*/")[2] ?? ""

    expect(rules).not.toMatch(/color-mix\(\s*in srgb,\s*currentColor/)
  })

  it("keeps every light-dark value inside the @supports guard", () => {
    // Comments are stripped so prose about `light-dark()` is not mistaken for a
    // declaration.
    const declarations = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "")

    const guardIndex = declarations.indexOf("@supports (color: light-dark(")

    expect(guardIndex).toBeGreaterThan(-1)
    // The fallbacks share a specificity with the guarded rules, so any
    // unguarded `light-dark()` before the guard would silently win in engines
    // that do support it, and any fallback after it would silently win too.
    expect(declarations.slice(0, guardIndex)).not.toContain("light-dark(")
  })

  it("defines every token used by a component rule", () => {
    const used = new Set(
      [...stylesheet.matchAll(/var\((--[a-z-]+)\)/g)].map((match) => match[1]),
    )

    // Font variables come from next/font, and Tailwind re-exports two of them.
    const external = new Set([
      "--font-geist-sans",
      "--font-geist-mono",
      "--color-background",
      "--color-foreground",
    ])

    for (const token of used) {
      if (external.has(token as string)) {
        continue
      }

      expect(stylesheet, token).toMatch(
        new RegExp(`(^|[;{\\s])${token}\\s*:`),
      )
    }
  })

  it("keeps the CSS focus ring on a neutral token rather than the accent", () => {
    expect(stylesheet).toContain("outline: 2px solid var(--focus-ring)")
  })

  it("derives the stylesheet accent foreground from the same rule as the code", () => {
    // Every light preset accent prefers white text and every dark preset
    // accent prefers near-black, so one shared declaration covers all four.
    expect(stylesheet).toContain("--accent-foreground: light-dark(#ffffff, #111111)")

    for (const preset of THEME_PRESETS) {
      expect(
        accentForeground(PRESET_PALETTES[preset].accent.light),
        `${preset} light`,
      ).toBe("#ffffff")
      expect(
        accentForeground(PRESET_PALETTES[preset].accent.dark),
        `${preset} dark`,
      ).toBe("#111111")
    }
  })
})