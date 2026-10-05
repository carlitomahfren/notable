import { readJson, writeJson } from "@/lib/storage/local-storage"

export const SETTINGS_STORAGE_KEY = "notes-app.settings"

export interface AppSettings {
  welcomeNotesSeeded: boolean
}

export const initialAppSettings: AppSettings = {
  welcomeNotesSeeded: false,
}

export interface SettingsRepository {
  get(): Promise<AppSettings>
  save(settings: AppSettings): Promise<AppSettings>
}

function coerceSettings(value: unknown): AppSettings {
  if (typeof value !== "object" || value === null) {
    return initialAppSettings
  }

  const candidate = value as Partial<AppSettings>

  return {
    welcomeNotesSeeded:
      typeof candidate.welcomeNotesSeeded === "boolean"
        ? candidate.welcomeNotesSeeded
        : initialAppSettings.welcomeNotesSeeded,
  }
}

export class LocalStorageSettingsRepository implements SettingsRepository {
  async get(): Promise<AppSettings> {
    const result = readJson<unknown>(SETTINGS_STORAGE_KEY)

    if (result.status !== "value") {
      return initialAppSettings
    }

    return coerceSettings(result.value)
  }

  async save(settings: AppSettings): Promise<AppSettings> {
    const next = coerceSettings(settings)

    writeJson(SETTINGS_STORAGE_KEY, next)

    return next
  }
}