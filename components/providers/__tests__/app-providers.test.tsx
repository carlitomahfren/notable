import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"

import { AppProviders } from "@/components/providers/app-providers"

function installThrowingWindow() {
  const storage = {
    getItem() {
      throw new Error("localStorage must not be read during server rendering")
    },
    setItem() {
      throw new Error("localStorage must not be written during server rendering")
    },
    removeItem() {
      throw new Error("localStorage must not be mutated during server rendering")
    },
  }

  const stub = { localStorage: storage }

  Object.defineProperty(globalThis, "window", {
    value: stub,
    configurable: true,
    writable: true,
  })

  return stub
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window")
})

describe("AppProviders", () => {
  it("renders children without touching localStorage", () => {
    installThrowingWindow()

    const markup = renderToStaticMarkup(
      <AppProviders>
        <p>workspace</p>
      </AppProviders>,
    )

    expect(markup).toContain("workspace")
  })

  it("renders without a window present at all", () => {
    expect(() =>
      renderToStaticMarkup(
        <AppProviders>
          <p>workspace</p>
        </AppProviders>,
      ),
    ).not.toThrow()
  })
})