import { type ThemePreferences } from "@/lib/theme/theme-config"
import {
  coerceThemePreferences,
  readStoredTheme,
  writeStoredTheme,
} from "@/lib/theme/theme-utils"

/**
 * Theme preferences live under their own storage key and never share the notes
 * repository, so changing appearance can neither read nor rewrite note data.
 */
export interface ThemeRepository {
  get(): Promise<ThemePreferences>
  save(preferences: ThemePreferences): Promise<ThemePreferences>
}

export class LocalStorageThemeRepository implements ThemeRepository {
  /**
   * Synchronous read used for the first client render. The bootstrap script has
   * already painted the persisted theme, so the provider must agree with it
   * immediately rather than correcting itself a frame later.
   */
  getStored(): ThemePreferences {
    return readStoredTheme()
  }

  async get(): Promise<ThemePreferences> {
    return readStoredTheme()
  }

  async save(preferences: ThemePreferences): Promise<ThemePreferences> {
    const next = coerceThemePreferences(preferences)

    writeStoredTheme(next)

    return next
  }
}