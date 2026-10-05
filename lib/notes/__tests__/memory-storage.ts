import { vi } from "vitest"

export function createMemoryStorage(): Storage {
  const entries = new Map<string, string>()

  return {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key) => (entries.has(key) ? (entries.get(key) as string) : null),
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => {
      entries.delete(key)
    },
    setItem: (key, value) => {
      entries.set(key, String(value))
    },
  } as Storage
}

export function stubBrowser(storage: Storage): void {
  vi.stubGlobal("window", { localStorage: storage })
}

export function clearBrowserStub(): void {
  vi.unstubAllGlobals()
}