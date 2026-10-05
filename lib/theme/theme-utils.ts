import {
  DEFAULT_THEME_PREFERENCES,
  PRESET_PALETTES,
  THEME_STORAGE_KEY,
  type ColorMode,
  type ThemePreset,
  type ThemePreferences,
} from "@/lib/theme/theme-config"
import { readJson, writeJson } from "@/lib/storage/local-storage"

/** Hardest light canvas used when checking a lifted accent. */
const LIGHT_REFERENCE = "#ffffff"

/**
 * Hardest dark canvas used when checking a lifted accent. Slightly lighter than
 * any preset's dark background so a lift that passes here passes everywhere.
 */
const DARK_REFERENCE = "#202020"

const MIN_TEXT_CONTRAST = 4.5

const MIX_STEPS = 20

export type ResolvedColorMode = "light" | "dark"

/**
 * Normalizes `#rgb`, `#rrggbb`, and `rrggbb` to a lowercase `#rrggbb`. Returns
 * null for anything else, including `rgb()` functions and named colors, so only
 * a real hex seed is ever persisted.
 */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim().replace(/^#/, "")

  if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
    return null
  }

  if (trimmed.length === 3) {
    return `#${trimmed
      .toLowerCase()
      .split("")
      .map((character) => character + character)
      .join("")}`
  }

  if (trimmed.length === 6) {
    return `#${trimmed.toLowerCase()}`
  }

  return null
}

function channelToLinear(channel: number): number {
  const ratio = channel / 255

  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
}

function parseChannels(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex) ?? "#000000"

  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ]
}

function toHex(channels: [number, number, number]): string {
  return `#${channels
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`
}

/** WCAG relative luminance of a `#rrggbb` color. */
export function relativeLuminance(hex: string): number {
  const [red, green, blue] = parseChannels(hex).map(channelToLinear)

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** WCAG contrast ratio between two `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)

  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)

  return (lighter + 0.05) / (darker + 0.05)
}

/** Blends two hex colors, where `amount` 0 keeps `from` and 1 returns `to`. */
export function mixHex(from: string, to: string, amount: number): string {
  const start = parseChannels(from)
  const end = parseChannels(to)

  return toHex([
    start[0] + (end[0] - start[0]) * amount,
    start[1] + (end[1] - start[1]) * amount,
    start[2] + (end[2] - start[2]) * amount,
  ])
}

/**
 * Text color for an accent surface. Near-black is preferred over pure black
 * because it looks less harsh, but a narrow band of mid-lightness accents
 * cannot reach 4.5:1 with it. Falling back to pure black or white closes that
 * band, because one of the two extremes always clears 4.5:1.
 */
export function accentForeground(accent: string): string {
  const onWhite = contrastRatio(accent, "#ffffff")
  const onNearBlack = contrastRatio(accent, "#111111")
  const preferred = onWhite >= onNearBlack ? "#ffffff" : "#111111"

  if (contrastRatio(accent, preferred) >= MIN_TEXT_CONTRAST) {
    return preferred
  }

  return onWhite >= contrastRatio(accent, "#000000") ? "#ffffff" : "#000000"
}

function liftAgainst(accent: string, reference: string, towards: string): string {
  if (contrastRatio(accent, reference) >= MIN_TEXT_CONTRAST) {
    return accent
  }

  for (let step = 1; step <= MIX_STEPS; step += 1) {
    const candidate = mixHex(accent, towards, step / MIX_STEPS)

    if (contrastRatio(candidate, reference) >= MIN_TEXT_CONTRAST) {
      return candidate
    }
  }

  return towards
}

/** Darkened accent that stays readable as text on a light canvas. */
export function deriveAccentLift(accent: string): string {
  return liftAgainst(accent, LIGHT_REFERENCE, "#000000")
}

/** Lightened accent that stays readable as text on a dark canvas. */
export function deriveAccentLiftDark(accent: string): string {
  return liftAgainst(accent, DARK_REFERENCE, "#ffffff")
}

export interface AccentTokens {
  accent: string
  accentForeground: string
  accentLift: string
  accentLiftDark: string
}

/**
 * Resolves the four accent-related tokens. Presets use their authored values; a
 * custom seed is only adjusted enough to stay readable in each mode.
 */
export function resolveAccentTokens(
  accent: string | null,
  preset: ThemePreset,
  mode: ResolvedColorMode,
): AccentTokens {
  const seed = normalizeHex(accent)

  if (seed === null) {
    const palette = PRESET_PALETTES[preset]

    return {
      accent: palette.accent[mode],
      accentForeground: accentForeground(palette.accent[mode]),
      accentLift: palette.accentLift[mode],
      accentLiftDark: palette.accentLift[mode],
    }
  }

  return {
    accent: seed,
    accentForeground: accentForeground(seed),
    accentLift: deriveAccentLift(seed),
    accentLiftDark: deriveAccentLiftDark(seed),
  }
}

function isColorMode(value: unknown): value is ColorMode {
  return value === "system" || value === "light" || value === "dark"
}

function isThemePreset(value: unknown): value is ThemePreset {
  return (
    value === "default" || value === "paper" || value === "forest" || value === "lavender"
  )
}

/**
 * Rebuilds preferences from arbitrary parsed JSON. Every field falls back
 * independently, so one malformed value never discards the rest.
 */
export function coerceThemePreferences(value: unknown): ThemePreferences {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_THEME_PREFERENCES }
  }

  const candidate = value as Partial<Record<keyof ThemePreferences, unknown>>

  return {
    colorMode: isColorMode(candidate.colorMode)
      ? candidate.colorMode
      : DEFAULT_THEME_PREFERENCES.colorMode,
    preset: isThemePreset(candidate.preset)
      ? candidate.preset
      : DEFAULT_THEME_PREFERENCES.preset,
    accent:
      candidate.accent === null || candidate.accent === undefined
        ? null
        : normalizeHex(candidate.accent) ?? DEFAULT_THEME_PREFERENCES.accent,
  }
}

/** Reads persisted preferences synchronously and never throws. */
export function readStoredTheme(): ThemePreferences {
  const result = readJson<unknown>(THEME_STORAGE_KEY)

  if (result.status !== "value") {
    return { ...DEFAULT_THEME_PREFERENCES }
  }

  return coerceThemePreferences(result.value)
}

/** Persists preferences, reporting failure instead of throwing. */
export function writeStoredTheme(preferences: ThemePreferences): boolean {
  try {
    writeJson(THEME_STORAGE_KEY, coerceThemePreferences(preferences))

    return true
  } catch {
    return false
  }
}

/** Root attributes describing the stored preference, used by CSS and the UI. */
export function themeRootAttributes(preferences: ThemePreferences): {
  colorScheme: ColorMode
  preset: ThemePreset
} {
  return { colorScheme: preferences.colorMode, preset: preferences.preset }
}