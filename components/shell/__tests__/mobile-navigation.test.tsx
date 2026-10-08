// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotesShell } from "@/components/shell/notes-shell"

import {
  clearStorage,
  renderWithProviders,
  seedStorage,
} from "@/components/notes/__tests__/test-harness"
import {
  click,
  navButton,
  query,
  queryAll,
  unmountAll,
} from "@/components/notes/__tests__/test-render"

const navigation = vi.hoisted(() => ({
  pathname: { value: "/notes" },
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname.value,
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

function bottomBar(): HTMLElement {
  const bar = query(".shell-bottom-nav", document)

  if (bar === null) {
    throw new Error("bottom bar not found")
  }

  return bar
}

function labelled(root: ParentNode, label: string): HTMLElement | null {
  return queryAll<HTMLElement>(".shell-nav-button", root).find(
    (element) =>
      element.querySelector(".shell-nav-button__label")?.textContent?.trim() ===
      label,
  ) ?? null
}

beforeEach(async () => {
  clearStorage()
  navigation.pathname.value = "/notes"
  await seedStorage([])
})

afterEach(async () => {
  await unmountAll()

  clearStorage()
})

describe("mobile navigation", () => {
  /*
   * A bottom bar that is missing a destination is not a smaller version of the
   * top bar, it is a broken one. Every destination has to be reachable without a
   * pointer or a wide screen.
   */
  it("carries every destination", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const bar = bottomBar()

    expect(labelled(bar, "Home")?.getAttribute("href")).toBe("/")
    expect(labelled(bar, "All Notes")).not.toBeNull()
    expect(labelled(bar, "Pinned")).not.toBeNull()
    expect(query(".shell-tags__trigger", bar)).not.toBeNull()
    expect(labelled(bar, "Settings")).not.toBeNull()
  })

  it("works without any viewport information", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    /*
     * jsdom has no layout, so anything that behaved differently at a phone size
     * would still be reachable here. That is the point: the bar depends on
     * nothing but the stylesheet.
     */
    await click(navButton("Pinned", bottomBar()))

    expect(labelled(bottomBar(), "Pinned")?.getAttribute("aria-current")).toBe(
      "true",
    )
  })

  it("keeps the desktop bar and the mobile bar in step", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(navButton("Pinned", bottomBar()))

    /*
     * Both bars read the same workspace view, so choosing a destination in one
     * cannot leave the other showing a stale selection.
     */
    const topBar = query(".shell-top-bar") as HTMLElement

    expect(topBar).not.toBeNull()
    expect(navButton("Pinned", topBar).getAttribute("aria-current")).toBe("true")
  })

  it("keeps the tag disclosure inside the bar it belongs to", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const bar = bottomBar()

    expect(query(".shell-tags", bar)?.getAttribute("data-placement")).toBe(
      "bottom",
    )
  })

  it("exposes a floating create action for the thumb", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const fabs = queryAll<HTMLElement>(
      '.shell-new-note[data-variant="fab"]',
      container,
    )

    expect(fabs).toHaveLength(1)
    expect(fabs[0].textContent).toContain("New note")
  })

  it("names both create controls identically, so one label suffices", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const labels = queryAll<HTMLElement>(".shell-new-note__label", container).map(
      (element) => element.textContent?.trim(),
    )

    expect(new Set(labels).size).toBe(1)
  })

  it("does not put the create action inside a landmark of its own", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    // A floating action button is a control, not a navigation destination.
    expect(query('nav[aria-label="Primary"] .shell-new-note')).toBeNull()
  })

  it("skips past the bars straight to the notes", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const skip = query(".shell-skip-link", container)

    expect(skip?.getAttribute("href")).toBe("#shell-main")
  })
})

/*
 * The pill, rather than a full-width bar.
 *
 * jsdom resolves no layout, so these tests pin the structure that produces the shape:
 * the landmark is the floating surface itself, and it holds exactly five
 * destinations with no item positioned on its own. The stylesheet invariants that
 * give the pill its width, edges and equal columns live in `globals-accessibility`,
 * where the stylesheet is parsed.
 */
describe("floating navigation pill", () => {
  it("carries five destinations in the pill", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(bottomBar().querySelectorAll(".shell-nav-button")).toHaveLength(4)
    expect(bottomBar().querySelector(".shell-tags__trigger")).not.toBeNull()
  })

  it("leads the pill with the way back to the landing page", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const home = labelled(bottomBar(), "Home")

    expect(home?.getAttribute("href")).toBe("/")
    expect(bottomBar().firstElementChild?.contains(home as HTMLElement)).toBe(
      true,
    )
  })

  it("does not put the create action inside the pill", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    /*
     * Separate rows are what guarantees the two floating controls can never overlap,
     * whatever the label lengths or the safe-area insets do.
     */
    expect(query(".shell-fab-layer", container)?.contains(bottomBar())).toBe(false)
    expect(bottomBar().querySelector(".shell-new-note")).toBeNull()
  })

  it("keeps the Tags destination inside the pill it belongs to", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const tags = query(".shell-tags", bottomBar())

    expect(tags?.dataset.placement).toBe("bottom")
    expect(tags?.querySelector(".shell-tags__panel")).toBeNull()

    await click(tags?.querySelector(".shell-tags__trigger") as HTMLElement)

    expect(
      query(".notes-workspace__name", document)?.textContent?.trim(),
    ).toBe("Tags")
  })
})