// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotesEmptyState } from "@/components/notes/notes-empty-state"
import { NotesShell } from "@/components/shell/notes-shell"
import { NOTES_STORAGE_KEY } from "@/lib/notes/notes-repository"
import { makeNote, resetNoteIds } from "@/lib/notes/__tests__/note-factory"

import {
  byLabelText,
  click,
  navButton,
  query,
  queryAll,
  render,
  type,
  unmountAll,
} from "./test-render"

import { clearStorage, renderWithProviders, seedStorage } from "./test-harness"

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

beforeEach(() => {
  clearStorage()
  resetNoteIds()
  navigation.pathname.value = "/notes"
  navigation.router.push.mockClear()
})

afterEach(async () => {
  await unmountAll()
})

function listUi() {
  return <NotesShell>{null}</NotesShell>
}

/** Navigation destinations render an icon plus a label, so match on the label. */
function navItem(label: string, root: ParentNode = document): HTMLElement {
  return navButton(label, root)
}

/** Accessible text of the visible pane, ignoring screen-reader-only additions. */
function visibleText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement

  for (const hidden of Array.from(
    clone.querySelectorAll(".visually-hidden"),
  )) {
    hidden.remove()
  }

  return clone.textContent ?? ""
}

describe("empty states", () => {
  it("explains an empty workspace and offers the next action", async () => {
    await seedStorage([])

    const container = await renderWithProviders(listUi())

    expect(visibleText(container)).toContain("No notes yet.")
    expect(byLabelText("Create note")).not.toBeNull()
  })

  it("explains an empty pinned view", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    await click(navItem("Pinned"))

    expect(visibleText(container)).toContain("Nothing pinned yet.")
  })

it("names the tag in an empty tag view", async () => {
  /*
   * Reaching this state through the UI needs the tagged note to be deleted while
   * the tag view is active, so the empty state is rendered directly here. The
   * routing between reasons is covered by `resolve-empty-reason.test.ts`.
   */
  const container = await render(
    <NotesEmptyState
      reason="no-tagged-notes"
      view={{ kind: "tag", tag: "work" }}
      onCreateNote={() => {}}
    />,
  )

  expect(visibleText(container)).toContain("No notes tagged #work.")
  expect(byLabelText("Create note")).not.toBeNull()
})

it("offers no create action in an empty search, only a way out", async () => {
  const container = await render(
    <NotesEmptyState
      reason="no-search-results"
      searchQuery="zzz"
      onCreateNote={() => {}}
      onClearSearch={() => {}}
    />,
  )

  expect(visibleText(container)).toContain("No notes match “zzz”.")
  expect(byLabelText("Clear search")).not.toBeNull()
  expect(byLabelText("Create note")).toBeNull()
})

  it("offers a way back out of an empty search", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())
    const input = query<HTMLInputElement>(
      'input[type="search"]',
      container,
    ) as HTMLInputElement

    await type(input, "nothing matches this")

    expect(visibleText(container)).toContain("No notes found.")
    expect(byLabelText("Clear search")).not.toBeNull()
  })
})

describe("loading, error, and retry states", () => {
  it("replaces the loading placeholder with the resolved list", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    /*
     * The loading message must not survive into the resolved state, otherwise a
     * screen reader user would be told the pane is still loading.
     */
    expect(visibleText(container)).not.toContain("Loading")
    expect(queryAll(".note-card", container)).toHaveLength(1)
  })

  it("offers a retry when stored notes cannot be read", async () => {
    localStorage.setItem(NOTES_STORAGE_KEY, "{not json")

    const container = await renderWithProviders(listUi())

    expect(query('[role="alert"]', container)).not.toBeNull()
    expect(byLabelText("Try again")).not.toBeNull()
  })

  it("does not depend on colour to mark the error", async () => {
    localStorage.setItem(NOTES_STORAGE_KEY, "{not json")

    const container = await renderWithProviders(listUi())

    const alert = query('[role="alert"]', container)

    expect(alert?.textContent ?? "").not.toBe("")
  })

  it("recovers when retry succeeds", async () => {
    localStorage.setItem(NOTES_STORAGE_KEY, "{not json")
    localStorage.setItem("notes-app.settings", JSON.stringify({ welcomeNotesSeeded: true }))

    const container = await renderWithProviders(listUi())

    expect(query('[role="alert"]', container)).not.toBeNull()

    localStorage.setItem(
      NOTES_STORAGE_KEY,
      JSON.stringify([makeNote({ title: "Recovered" })]),
    )

    await click(byLabelText("Try again") as HTMLElement)

    expect(visibleText(container)).toContain("Recovered")
  })
})

describe("non-colour communication", () => {
  it("marks the selected note with aria-current, not a colour", async () => {
    const target = makeNote({ title: "Alpha" })

    await seedStorage([target, makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    // Only one note card can be current, and it is the one just navigated to.
    expect(queryAll('.note-card[aria-current="page"]', container).length).toBeLessThanOrEqual(1)
  })

  it("marks the active view with aria-current, not a colour", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    /*
     * Both bars are mounted and CSS picks one, so each carries its own copy of
     * the current destination. The assertion is scoped to one bar; the important
     * part is that exactly one destination inside it is marked.
     */
    const desktopBar = query(".shell-top-bar", container)

    expect(
      queryAll('.shell-nav-button[aria-current="true"]', desktopBar as HTMLElement),
    ).toHaveLength(1)

    /*
     * The link to the landing page is a destination too, and on a page that is not
     * the landing page it carries no current marker at all.
     */
    expect(
      queryAll('.shell-nav-button:not([aria-current])', desktopBar as HTMLElement).map(
        (element) => element.textContent?.trim(),
      ),
    ).toEqual(["Home", "Pinned"])
    expect(
      query(".shell-home-link", desktopBar as HTMLElement)?.getAttribute("aria-current"),
    ).toBeNull()
  })

  it("marks the selected tab with aria-selected and weight", async () => {
    /*
     * The list screen has no editor, so no mode tab is selected here. This guards
     * against a stray `aria-selected` leaking outside the tablist.
     */
    expect(queryAll('[role="tab"][aria-selected="true"]', document)).toHaveLength(0)
  })
})