// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotesShell } from "@/components/shell/notes-shell"
import { makeNote } from "@/lib/notes/__tests__/note-factory"

import {
  clearStorage,
  renderWithProviders,
  seedStorage,
} from "@/components/notes/__tests__/test-harness"
import {
  click,
  navButton,
  query,
  renderedTitles,
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

function bar(selector: string): HTMLElement {
  const found = query<HTMLElement>(selector, document)

  if (found === null) {
    throw new Error(`bar not found: ${selector}`)
  }

  return found
}

function bottomBar(): HTMLElement {
  return bar(".shell-bottom-nav")
}

function topBar(): HTMLElement {
  return bar(".shell-top-bar__nav")
}

/**
 * jsdom applies no stylesheet, so the screen a phone reaches by cascade — a
 * note open, the list given over to it — is stood in for by hiding the very
 * pane the rule hides. The rule being simulated is
 * `.shell[data-editor-open="true"] .shell-pane--list { display: none }`, which
 * is what makes a press on an active-looking destination a dead end.
 */
function giveTheNoteTheWholeScreen(): void {
  const pane = query<HTMLElement>(".shell-pane--list", document)

  if (pane === null) {
    throw new Error("list pane not found")
  }

  pane.style.display = "none"
}

beforeEach(async () => {
  clearStorage()
  navigation.pathname.value = "/notes"
  navigation.router.push.mockClear()
  await seedStorage([
    makeNote({ title: "Alpha" }),
    makeNote({ title: "Beta", isPinned: true }),
  ])
})

afterEach(async () => {
  await unmountAll()

  clearStorage()
})

describe("workspace destinations while the list is off screen", () => {
  it("walks back to the list route for All Notes", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    giveTheNoteTheWholeScreen()
    await click(navButton("All Notes", bottomBar()))

    expect(navigation.router.push).toHaveBeenCalledWith("/notes")
    expect(navButton("All Notes", bottomBar()).getAttribute("aria-current")).toBe(
      "true",
    )
  })

  it("walks back to the list route for Pinned, view chosen first", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    giveTheNoteTheWholeScreen()
    await click(navButton("Pinned", bottomBar()))

    expect(navigation.router.push).toHaveBeenCalledWith("/notes")
    expect(navButton("Pinned", bottomBar()).getAttribute("aria-current")).toBe(
      "true",
    )
    expect(renderedTitles()).toEqual(["Beta"])
  })

  it("walks back to the list route for Tags", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    giveTheNoteTheWholeScreen()
    await click(navButton("Tags", bottomBar()))

    expect(navigation.router.push).toHaveBeenCalledWith("/notes")
    expect(navButton("Tags", bottomBar()).getAttribute("aria-current")).toBe(
      "true",
    )
  })

  it("reaches the workspace from the top bar where the phone swaps the bars in", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    /*
     * A short or landscape screen drops the bottom bar and puts the top bar's
     * navigation back. The same dead end would open there, and the same route
     * out of it has to work: what decides is the list being off screen, not
     * which bar the destination happened to sit in.
     */
    giveTheNoteTheWholeScreen()
    await click(navButton("Pinned", topBar()))

    expect(navigation.router.push).toHaveBeenCalledWith("/notes")
    expect(navButton("Pinned", topBar()).getAttribute("aria-current")).toBe(
      "true",
    )
  })
})

describe("workspace destinations while the list is on screen", () => {
  it("switches the list in place beside an open note, without leaving the route", async () => {
    navigation.pathname.value = "/notes/note-alpha"

    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(navButton("Pinned", topBar()))

    expect(navigation.router.push).not.toHaveBeenCalled()
    expect(navButton("Pinned", topBar()).getAttribute("aria-current")).toBe(
      "true",
    )
    expect(renderedTitles()).toEqual(["Beta"])
  })

  it("leaves the route alone from the list screen itself", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(navButton("Pinned", bottomBar()))

    expect(navigation.router.push).not.toHaveBeenCalled()
    expect(navButton("Pinned", bottomBar()).getAttribute("aria-current")).toBe(
      "true",
    )
    expect(renderedTitles()).toEqual(["Beta"])
  })
})
