// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { AppSplash } from "@/components/splash/app-splash"

import { query, render, unmountAll, wait } from "@/components/notes/__tests__/test-render"

const originalRequestAnimationFrame = window.requestAnimationFrame
const originalCancelAnimationFrame = window.cancelAnimationFrame

beforeAll(() => {
  // jsdom does not paint frames, so the two-frame staging has no clock to wait
  // on. Running the callback synchronously makes the stage transitions happen
  // inside the render's `act` and keeps the tests deterministic.
  window.requestAnimationFrame = (callback) => {
    callback(0)
    return 0
  }
  window.cancelAnimationFrame = () => {}
})

afterEach(async () => {
  window.requestAnimationFrame = originalRequestAnimationFrame
  window.cancelAnimationFrame = originalCancelAnimationFrame
  await unmountAll()
})

describe("the entry splash", () => {
  it("shows the wordmark once and lets go after the presentation window", async () => {
    // The component is not server-rendered until its mount effect runs: at
    // rest the layout tree holds no overlay at all, so a first paint (or a
    // document that never hydrates) never sees a blank screen.
    expect(query(".app-splash", document.body)).toBeNull()

    const container = await render(<AppSplash />)

    const overlay = query(".app-splash", container)
    const mark = query(".app-splash__mark", container)

    expect(overlay).not.toBeNull()
    expect(overlay?.getAttribute("data-state")).toBe("entering")
    expect(overlay?.getAttribute("aria-hidden")).toBe("true")
    expect(mark?.textContent?.trim()).toBe("Notable")
    expect(query(".app-splash__rule", container)).not.toBeNull()
    expect(queryAllInteractive(container)).toHaveLength(0)

    await wait(2800)

    expect(query(".app-splash", container)).toBeNull()
  }, 10_000)

  it("rests clean between documents", async () => {
    const container = await render(<AppSplash />)
    await wait(2800)

    expect(query(".app-splash", container)).toBeNull()

    // A fresh mount walks the same entry again: a new document, a new splash.
    const again = await render(<AppSplash />)
    await wait(2800)

    expect(query(".app-splash", again)).toBeNull()
  }, 10_000)
})

function queryAllInteractive(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("a, button, input, textarea, select, [tabindex]"),
  )
}