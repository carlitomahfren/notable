export const THEME_STORAGE_KEY = "notes-app.theme"

export const COLOR_MODES = ["system", "light", "dark"] as const
export type ColorMode = (typeof COLOR_MODES)[number]

export const THEME_PRESETS = ["default", "paper", "forest", "lavender"] as const
export type ThemePreset = (typeof THEME_PRESETS)[number]

export interface ThemePreferences {
  colorMode: ColorMode
  preset: ThemePreset
  /** A normalized `#rrggbb` seed, or null to use the preset accent. */
  accent: string | null
}

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  colorMode: "system",
  preset: "default",
  accent: null,
}

export const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
}

export const PRESET_LABELS: Record<ThemePreset, string> = {
  default: "Default",
  paper: "Paper",
  forest: "Forest",
  lavender: "Lavender",
}

/** Short descriptions shown in the Appearance dialog. */
export const PRESET_DESCRIPTIONS: Record<ThemePreset, string> = {
  default: "Neutral slate greys with a blue accent.",
  paper: "Warm cream paper tones with an amber accent.",
  forest: "Deep greens with a botanical accent.",
  lavender: "Soft violet tones with a lilac accent.",
}

/**
 * Preset palettes. Every value is authored rather than computed so each preset
 * keeps a deliberate identity, and both variants of each preset are checked for
 * text, muted text, border, and accent contrast.
 */
export interface PresetPalette {
  /** Accent used as a surface, with `--accent-foreground` on top of it. */
  accent: { light: string; dark: string }
  /** Accent adjusted so it stays readable as text on its own mode's canvas. */
  accentLift: { light: string; dark: string }
}

export const PRESET_PALETTES: Record<ThemePreset, PresetPalette> = {
  default: {
    accent: { light: "#3b5bdb", dark: "#5c7cfa" },
    accentLift: { light: "#2f4bb8", dark: "#8fa6ff" },
  },
  paper: {
    accent: { light: "#a4601f", dark: "#d99a4e" },
    accentLift: { light: "#8a4f16", dark: "#e8b877" },
  },
  forest: {
    accent: { light: "#1f6b45", dark: "#4fb37c" },
    accentLift: { light: "#185736", dark: "#7fce9f" },
  },
  lavender: {
    accent: { light: "#6d4bc4", dark: "#a78bfa" },
    accentLift: { light: "#5a3ba8", dark: "#c4b1fd" },
  },
}