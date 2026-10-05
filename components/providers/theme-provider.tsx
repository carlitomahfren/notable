"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import {
  COLOR_MODES,
  DEFAULT_THEME_PREFERENCES,
  PRESET_PALETTES,
  THEME_PRESETS,
  type ColorMode,
  type ThemePreset,
  type ThemePreferences,
} from "@/lib/theme/theme-config"
import { LocalStorageThemeRepository } from "@/lib/theme/theme-repository"
import {
  accentForeground,
  deriveAccentLift,
  deriveAccentLiftDark,
  normalizeHex,
  resolveAccentTokens,
  writeStoredTheme,
  type AccentTokens,
  type ResolvedColorMode,
} from "@/lib/theme/theme-utils"

const ACCENT_VARIABLES = [
  "--accent",
  "--accent-foreground",
  "--accent-lift",
  "--accent-lift-dark",
] as const

interface ThemeContextValue {
  /** Exactly what is stored, with the accent still a raw seed. */
  preferences: ThemePreferences
  /** Effective color mode, with `system` already resolved. */
  resolvedMode: ResolvedColorMode
  /** Accent tokens for the active preset or custom seed. */
  accentTokens: AccentTokens
  hasCustomAccent: boolean
  /** False once a write to local storage has failed, so the UI can say so. */
  isPersistent: boolean
  setColorMode: (mode: ColorMode) => void
  setPreset: (preset: ThemePreset) => void
  /** Accepts any hex form; unusable values are ignored. */
  setAccent: (value: string) => void
  clearAccent: () => void
  reset: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"

function getColorSchemeList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null
  }

  return window.matchMedia(COLOR_SCHEME_QUERY)
}

/** Always read live, so switching back to system never uses a stale value. */
function readSystemPrefersDark(): boolean {
  return getColorSchemeList()?.matches ?? false
}

/** The server cannot know the operating system preference. */
function readServerSystemPrefersDark(): boolean {
  return false
}

export interface ThemeProviderProps {
  children: ReactNode
  repository?: LocalStorageThemeRepository
}

/**
 * Owns appearance only. Theme state is intentionally absent from
 * NotesState, WorkspaceState, and ShellState, so nothing here can read or write
 * note data.
 */
export function ThemeProvider({
  children,
  repository,
}: ThemeProviderProps) {
  const [themeRepository] = useState(
    () => repository ?? new LocalStorageThemeRepository(),
  )

  /*
   * The first render must be identical on the server and on the client, or React
   * reports a hydration mismatch on everything derived from the theme. Storage is
   * a client-only input, so the first render starts from the documented defaults
   * on both sides and the stored preferences are adopted in the layout effect
   * below, which runs before the browser paints. The no-flash bootstrap script has
   * already painted the stored colours by then, so nothing visibly changes; the
   * component tree simply catches up before it is ever seen.
   */
  const [preferences, setPreferences] = useState<ThemePreferences>(
    () => ({ ...DEFAULT_THEME_PREFERENCES }),
  )

  // A storage failure must not break the app or trap the user in an error.
  const [isPersistent, setIsPersistent] = useState(true)

  // Only `system` needs the operating system. An explicit Light or Dark choice
  // must not keep a listener alive for a preference that can no longer change the
  // result, so the subscribe function closes over the current mode.
  const subscribeToSystemColorScheme = useCallback(
    (onStoreChange: () => void) => {
      if (preferences.colorMode !== "system") {
        return () => {}
      }

      const list = getColorSchemeList()

      if (list === null || typeof list.addEventListener !== "function") {
        return () => {}
      }

      list.addEventListener("change", onStoreChange)

      return () => list.removeEventListener("change", onStoreChange)
    },
    [preferences.colorMode],
  )

  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemColorScheme,
    readSystemPrefersDark,
    readServerSystemPrefersDark,
  )

  const resolvedMode: ResolvedColorMode =
    preferences.colorMode === "system"
      ? systemPrefersDark
        ? "dark"
        : "light"
      : preferences.colorMode

  // Adopt storage before paint. See the note on `preferences` above.
  useIsomorphicLayoutEffect(() => {
    setPreferences(themeRepository.getStored())
  }, [themeRepository])

  const accentTokens = useMemo(
    () => resolveAccentTokens(preferences.accent, preferences.preset, resolvedMode),
    [preferences.accent, preferences.preset, resolvedMode],
  )

  const commit = useCallback(
    (next: ThemePreferences) => {
      setPreferences(next)
      setIsPersistent(writeStoredTheme(next))
    },
    [],
  )

  const setColorMode = useCallback(
    (mode: ColorMode) => {
      if (!COLOR_MODES.includes(mode)) {
        return
      }

      commit({ ...preferences, colorMode: mode })
    },
    [commit, preferences],
  )

  const setPreset = useCallback(
    (preset: ThemePreset) => {
      if (!THEME_PRESETS.includes(preset)) {
        return
      }

      commit({ ...preferences, preset })
    },
    [commit, preferences],
  )

  const setAccent = useCallback(
    (value: string) => {
      const seed = normalizeHex(value)

      if (seed === null) {
        return
      }

      commit({ ...preferences, accent: seed })
    },
    [commit, preferences],
  )

  const clearAccent = useCallback(() => {
    commit({ ...preferences, accent: null })
  }, [commit, preferences])

  const reset = useCallback(() => {
    commit({ ...DEFAULT_THEME_PREFERENCES })
  }, [commit])

  // Applied before paint so switching a preset or accent never shows the old
  // palette for a frame.
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement
    const seed = preferences.accent

    root.setAttribute("data-color-scheme", preferences.colorMode)
    root.setAttribute("data-preset", preferences.preset)

    if (seed !== null) {
      root.style.setProperty("--accent", seed)
      root.style.setProperty("--accent-foreground", accentForeground(seed))
      root.style.setProperty("--accent-lift", deriveAccentLift(seed))
      root.style.setProperty("--accent-lift-dark", deriveAccentLiftDark(seed))

      return
    }

    // Preset accents live in the stylesheet, so the inline overrides that a
    // custom accent installed must be removed again.
    for (const variable of ACCENT_VARIABLES) {
      root.style.removeProperty(variable)
    }
  }, [preferences])

  const value = useMemo<ThemeContextValue>(
    () => ({
      preferences,
      resolvedMode,
      accentTokens,
      hasCustomAccent: preferences.accent !== null,
      isPersistent,
      setColorMode,
      setPreset,
      setAccent,
      clearAccent,
      reset,
    }),
    [
      accentTokens,
      clearAccent,
      isPersistent,
      preferences,
      reset,
      resolvedMode,
      setAccent,
      setColorMode,
      setPreset,
    ],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (context === null) {
    throw new Error("useTheme must be used inside ThemeProvider")
  }

  return context
}

/** Accent tokens for a preset, used to preview swatches in the dialog. */
export function presetAccentTokens(
  preset: ThemePreset,
  mode: ResolvedColorMode,
): AccentTokens {
  return {
    accent: PRESET_PALETTES[preset].accent[mode],
    accentForeground: accentForeground(PRESET_PALETTES[preset].accent[mode]),
    accentLift: PRESET_PALETTES[preset].accentLift[mode],
    accentLiftDark: PRESET_PALETTES[preset].accentLift[mode],
  }
}