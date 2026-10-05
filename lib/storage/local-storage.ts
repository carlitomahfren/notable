export function isBrowser(): boolean {
  return typeof window !== "undefined"
}

export type StorageReadResult<T> =
  | { status: "absent" }
  | { status: "value"; value: T }
  | { status: "corrupt"; reason: string }

export function readJson<T>(key: string): StorageReadResult<T> {
  if (!isBrowser()) {
    return { status: "absent" }
  }

  let raw: string | null
  try {
    raw = window.localStorage.getItem(key)
  } catch (error) {
    return {
      status: "corrupt",
      reason:
        error instanceof Error ? error.message : "localStorage is unavailable",
    }
  }

  if (raw === null) {
    return { status: "absent" }
  }

  try {
    return { status: "value", value: JSON.parse(raw) as T }
  } catch (error) {
    return {
      status: "corrupt",
      reason:
        error instanceof Error ? error.message : "stored value is not valid JSON",
    }
  }
}

export function writeJson(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value))
}