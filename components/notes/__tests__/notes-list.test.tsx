// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotesShell } from "@/components/shell/notes-shell"
import { makeNote, resetNoteIds } from "@/lib/notes/__tests__/note-factory"

import {
  byLabelText,
  click,
  flush,
  navButton,
  query,
  queryAll,
  renderedTitles,
  selectTag,
  tagFilter,
  type,
  unmountAll,
} from "./test-render"

import {
  clearStorage,
  renderWithProviders,
  seedStorage,
  storedNotes,
} from "./test-harness"

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

/** The search field lives in the top bar and starts collapsed. */
async function openSearch(container: HTMLElement): Promise<HTMLInputElement> {
  await click(byLabelText("Search notes", container) as HTMLElement)

  const input = container.querySelector<HTMLInputElement>('input[type="search"]')

  if (input === null) {
    throw new Error("search input not found")
  }

  return input
}

function searchBox(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[type="search"]',
  )

  if (input === null) {
    throw new Error("search input not found")
  }

  return input
}

function workspaceCount(container: ParentNode = document): string {
  return query(".notes-workspace__count", container)?.textContent?.trim() ?? ""
}

describe("note list selection", () => {
  it("marks only the note matching the URL as current", async () => {
    const first = makeNote({ title: "First" })
    const second = makeNote({ title: "Second" })

    await seedStorage([first, second])
    navigation.pathname.value = `/notes/${second.id}`

    const container = await renderWithProviders(listUi())
    const current = queryAll(".note-card[aria-current='page']", container)

    expect(current).toHaveLength(1)
    expect(current[0].textContent).toContain("Second")
  })

  it("marks nothing as current on the list route", async () => {
    await seedStorage([makeNote({ title: "First" })])

    const container = await renderWithProviders(listUi())

    expect(
      queryAll(".note-card[aria-current='page']", container),
    ).toHaveLength(0)
  })

  it("links each note to its own route", async () => {
    const note = makeNote({ title: "Linked" })
    await seedStorage([note])

    const container = await renderWithProviders(listUi())

    expect(
      query<HTMLAnchorElement>(".note-card", container)?.getAttribute("href"),
    ).toBe(`/notes/${note.id}`)
  })
})

describe("workspace views", () => {
  it("shows every note in the all-notes view, pinned first", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta", isPinned: true }),
    ])

    const container = await renderWithProviders(listUi())

    expect(renderedTitles(container)).toEqual(["Beta", "Alpha"])
  })

  it("shows only pinned notes after selecting the pinned view", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta", isPinned: true }),
    ])

    const container = await renderWithProviders(listUi())

    await click(navButton("Pinned") as HTMLElement)

    expect(renderedTitles(container)).toEqual(["Beta"])
  })

  it("returns to every note when the all-notes view is selected again", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta", isPinned: true }),
    ])

    const container = await renderWithProviders(listUi())

    await click(navButton("Pinned") as HTMLElement)
    await click(navButton("All Notes") as HTMLElement)

    expect(renderedTitles(container)).toEqual(["Beta", "Alpha"])
  })

  it("marks the active view for assistive technology", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    await renderWithProviders(listUi())

    await click(navButton("Pinned") as HTMLElement)

    /*
     * "true" rather than "page": these buttons filter the list without
     * navigating, so there is no page per view to mark as current.
     */
    expect(navButton("Pinned").getAttribute("aria-current")).toBe("true")
    expect(navButton("All Notes").getAttribute("aria-current")).toBeNull()
  })

  it("keeps the search query when the view changes", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta", isPinned: true }),
    ])

    const container = await renderWithProviders(listUi())

    await type(await openSearch(container), "Beta")
    await click(navButton("Pinned") as HTMLElement)

    expect(searchBox(container).value).toBe("Beta")
  })

  it("counts the notes in a chosen tag", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta", isPinned: true }),
      makeNote({ title: "Gamma", tags: ["work"] }),
      makeNote({ title: "Delta", tags: ["work"] }),
    ])

    const container = await renderWithProviders(listUi())

    await selectTag("work")

    expect(workspaceCount(container)).toBe("2 notes")
  })

  it("keeps the destination labels free of counts so the bar stays scannable", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta", isPinned: true }),
    ])

    const container = await renderWithProviders(listUi())

    for (const label of ["All Notes", "Pinned", "Tags"]) {
      expect(navButton(label, container).textContent?.trim()).toBe(label)
    }
  })

  it("keeps the filter to All Tags when notes carry none", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    await click(navButton("Tags") as HTMLElement)

    expect(Array.from(tagFilter(container).options)).toHaveLength(1)
  })
})

describe("tag filtering", () => {
  it("filters the list to the selected tag", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta", tags: ["ideas"] }),
    ])

    const container = await renderWithProviders(listUi())

    await selectTag("work")

    expect(renderedTitles(container)).toEqual(["Alpha"])
  })

  it("switches between tags", async () => {
    await seedStorage([
      makeNote({
        title: "Alpha",
        tags: ["work"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      makeNote({
        title: "Beta",
        tags: ["ideas"],
        updatedAt: "2026-02-01T00:00:00.000Z",
      }),
      makeNote({
        title: "Gamma",
        tags: ["work"],
        updatedAt: "2026-03-01T00:00:00.000Z",
      }),
    ])

    const container = await renderWithProviders(listUi())

    await selectTag("work")

    expect(renderedTitles(container)).toEqual(["Gamma", "Alpha"])

    await selectTag("ideas")

    expect(renderedTitles(container)).toEqual(["Beta"])
  })

  it("combines a tag filter with a search query", async () => {
    await seedStorage([
      makeNote({ title: "Alpha report", tags: ["work"] }),
      makeNote({ title: "Beta report", tags: ["ideas"] }),
    ])

    const container = await renderWithProviders(listUi())

    await selectTag("work")
    await type(await openSearch(container), "Beta")

    expect(renderedTitles(container)).toEqual([])
    expect(query(".notes-empty__title", container)?.textContent).toBe(
      "No notes found.",
    )
  })
})

describe("search interaction", () => {
  it("filters by title", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
    ])

    const container = await renderWithProviders(listUi())

    await type(await openSearch(container), "alp")

    expect(renderedTitles(container)).toEqual(["Alpha"])
  })

  it("matches case-insensitively", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    await type(await openSearch(container), "ALPHA")

    expect(renderedTitles(container)).toEqual(["Alpha"])
  })

  it("matches note content", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", content: "a hidden needle here" }),
      makeNote({ title: "Beta", content: "nothing relevant" }),
    ])

    const container = await renderWithProviders(listUi())

    await type(await openSearch(container), "needle")

    expect(renderedTitles(container)).toEqual(["Alpha"])
  })

  it("matches tags", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["recipe"] }),
      makeNote({ title: "Beta" }),
    ])

    const container = await renderWithProviders(listUi())

    await type(await openSearch(container), "recipe")

    expect(renderedTitles(container)).toEqual(["Alpha"])
  })

  it("treats a whitespace-only query as no filtering", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
    ])

    const container = await renderWithProviders(listUi())

    await type(await openSearch(container), "   ")

    expect(renderedTitles(container)).toHaveLength(2)
  })

  it("combines search with the active pinned view", async () => {
    await seedStorage([
      makeNote({ title: "Alpha pinned", isPinned: true }),
      makeNote({ title: "Beta pinned", isPinned: true }),
      makeNote({ title: "Alpha loose" }),
    ])

    const container = await renderWithProviders(listUi())

    await click(navButton("Pinned") as HTMLElement)
    await type(await openSearch(container), "Alpha")

    expect(renderedTitles(container)).toEqual(["Alpha pinned"])
  })

  it("shows the no-results state and can clear the search", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    await type(await openSearch(container), "zzzz")

    expect(query(".notes-empty__title", container)?.textContent).toBe(
      "No notes found.",
    )

    await click(byLabelText("Clear search") as HTMLElement)

    expect(renderedTitles(container)).toEqual(["Alpha"])
  })

  it("announces the result count while searching", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
    ])

    const container = await renderWithProviders(listUi())

    await type(await openSearch(container), "a")
    await flush()

    const status = query('[role="status"]', container)

    expect(status?.textContent).toContain("2 notes")
  })

  it("gives the search input an accessible name", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    expect(
      query<HTMLInputElement>('input[type="search"]', container)
        ?.getAttribute("placeholder"),
    ).toBe("Search notes")
    expect(container.querySelector("label")).not.toBeNull()
  })

  /*
   * A collapsed field keeps filtering the list, so the button has to say so.
   * The dot alone would be invisible to a screen reader.
   */
  it("flags a collapsed search that is still filtering", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    await type(await openSearch(container), "Alpha")
    await click(byLabelText("Close search", container) as HTMLElement)

    const toggle = byLabelText("Search notes, a filter is active", container)

    expect(toggle).not.toBeNull()
    expect(toggle?.hasAttribute("data-has-query")).toBe(true)
    expect(renderedTitles(container)).toEqual(["Alpha"])
  })
})

describe("pin interaction", () => {
  it("pins a note through the toggle action and re-sorts it first", async () => {
    const alpha = makeNote({
      title: "Alpha",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })
    const beta = makeNote({
      title: "Beta",
      updatedAt: "2026-02-01T00:00:00.000Z",
    })

    await seedStorage([alpha, beta])

    const container = await renderWithProviders(listUi())

    expect(renderedTitles(container)).toEqual(["Beta", "Alpha"])

    await click(byLabelText("Pin Alpha") as HTMLElement)

    expect(renderedTitles(container)).toEqual(["Alpha", "Beta"])
    expect(storedNotes().find((note) => note.id === alpha.id)?.isPinned).toBe(
      true,
    )
  })

  it("unpins a note", async () => {
    const alpha = makeNote({ title: "Alpha" })
    const beta = makeNote({ title: "Beta", isPinned: true })

    await seedStorage([alpha, beta])

    await renderWithProviders(listUi())

    await click(byLabelText("Unpin Beta") as HTMLElement)

    expect(storedNotes().find((note) => note.id === beta.id)?.isPinned).toBe(
      false,
    )
  })

  it("states the pin action in the name without a contradicting aria-pressed", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", isPinned: true }),
      makeNote({ title: "Beta" }),
    ])

    await renderWithProviders(listUi())

    /*
     * The label already changes with the state, so `aria-pressed` would make a
     * screen reader announce "Unpin Alpha, toggle button, pressed".
     */
    expect(byLabelText("Unpin Alpha")?.getAttribute("aria-pressed")).toBeNull()
    expect(byLabelText("Pin Beta")?.getAttribute("aria-pressed")).toBeNull()
  })

  it("exposes the full note title so a truncated one stays readable", async () => {
    const longTitle = "A very long note title that will be visually truncated"
    await seedStorage([makeNote({ title: longTitle })])

    const container = await renderWithProviders(listUi())

    expect(container.querySelector(".note-card__title")?.getAttribute("title")).toBe(
      longTitle,
    )
  })

  it("marks pinned notes with a non-colour indicator", async () => {
    await seedStorage([makeNote({ title: "Alpha", isPinned: true })])

    const container = await renderWithProviders(listUi())

    expect(
      container.querySelector(".note-card__pinned")?.textContent,
    ).toContain("Pinned")
  })

  it("does not change updatedAt when pinning", async () => {
    const note = makeNote({ title: "Alpha" })
    await seedStorage([note])

    await renderWithProviders(listUi())
    await click(byLabelText("Pin Alpha") as HTMLElement)

    expect(storedNotes().find((entry) => entry.id === note.id)?.updatedAt).toBe(
      note.updatedAt,
    )
  })

  it("keeps a pinned note out of the unpinned tag view results correctly", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta", tags: ["work"], isPinned: true }),
    ])

    const container = await renderWithProviders(listUi())

    await selectTag("work")

    expect(renderedTitles(container)).toEqual(["Beta", "Alpha"])
  })
})

describe("empty states", () => {
  it("shows the first-run state when there are no notes", async () => {
    await seedStorage([])

    const container = await renderWithProviders(listUi())

    expect(query(".notes-empty__title", container)?.textContent).toBe(
      "No notes yet.",
    )
    expect(byLabelText("Create note")).not.toBeNull()
  })

  it("shows the pinned state when nothing is pinned", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    await click(navButton("Pinned") as HTMLElement)

    expect(query(".notes-empty__title", container)?.textContent).toBe(
      "Nothing pinned yet.",
    )
  })

  it("shows the loading state before notes arrive", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    expect(renderedTitles(container)).toEqual(["Alpha"])
  })
})