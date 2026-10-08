// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotesShell } from "@/components/shell/notes-shell"
import { makeNote, resetNoteIds } from "@/lib/notes/__tests__/note-factory"

import {
  byLabelText,
  checkbox,
  click,
  navButton,
  query,
  queryAll,
  renderedTitles,
  selectTag,
  selectValue,
  tagFilter,
  type,
  unmountAll,
} from "./test-render"

import { clearStorage, renderWithProviders, seedStorage, storedNotes } from "./test-harness"

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
  vi.restoreAllMocks()
})

function listUi() {
  return <NotesShell>{null}</NotesShell>
}

async function openSearch(container: HTMLElement): Promise<HTMLInputElement> {
  await click(byLabelText("Search notes", container) as HTMLElement)

  const input = container.querySelector<HTMLInputElement>('input[type="search"]')

  if (input === null) {
    throw new Error("search input not found")
  }

  return input
}

/** Opens the Tags workspace and picks one tag from its filter by name. */
async function openTag(container: HTMLElement, tag: string): Promise<void> {
  await selectTag(tag, container)
}

function workspaceName(container: ParentNode = document): string | null {
  return query(".notes-workspace__name", container)?.textContent?.trim() ?? null
}

function workspaceCount(container: ParentNode = document): string | null {
  return query(".notes-workspace__count", container)?.textContent?.trim() ?? null
}

function seed() {
  return [
    makeNote({ title: "Alpha", tags: ["work"], content: "ship the release" }),
    makeNote({ title: "Beta", tags: ["work", "ideas"] }),
    makeNote({ title: "Gamma", tags: ["ideas"] }),
  ]
}

describe("the tags workspace", () => {
  it("lists every tag once in its filter, most used first", async () => {
    await seedStorage(seed())

    const container = await renderWithProviders(listUi())

    await click(navButton("Tags") as HTMLElement)

    const options = Array.from(tagFilter(container).options)

    expect(options.map((option) => option.value)).toEqual(["", "ideas", "work"])
    expect(options.map((option) => option.textContent)).toEqual([
      "All Tags",
      "#ideas",
      "#work",
    ])
  })

  it("keeps the filter to All Tags when notes carry no tags", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    await click(navButton("Tags") as HTMLElement)

    expect(Array.from(tagFilter(container).options)).toHaveLength(1)
    expect(workspaceCount(container)).toBe("1 note")
  })

  it("names the workspace and counts it once a tag is chosen", async () => {
    await seedStorage(seed())

    const container = await renderWithProviders(listUi())

    await openTag(container, "work")

    expect(workspaceName(container)).toBe("Tags")
    expect(workspaceCount(container)).toBe("2 notes")
  })

  it("shows only the notes carrying that tag", async () => {
    await seedStorage(seed())

    const container = await renderWithProviders(listUi())

    await openTag(container, "work")

    expect(renderedTitles(container)).toEqual(["Alpha", "Beta"])
  })

  it("keeps the tag marked as current while its view is open", async () => {
    await seedStorage(seed())

    const container = await renderWithProviders(listUi())

    await openTag(container, "ideas")

    expect(navButton("Tags").getAttribute("aria-current")).toBe("true")

    await click(navButton("All Notes") as HTMLElement)

    expect(navButton("Tags").getAttribute("aria-current")).toBeNull()
    expect(workspaceName(container)).toBeNull()
  })

  it("shows no heading while every note is on screen", async () => {
    await seedStorage(seed())

    const container = await renderWithProviders(listUi())

    expect(workspaceName(container)).toBeNull()

    await click(navButton("Pinned") as HTMLElement)

    expect(workspaceName(container)).toBeNull()
  })

  it("heads the page with the workspace while the list is standing alone", async () => {
    await seedStorage(seed())

    const container = await renderWithProviders(listUi())

    await openTag(container, "work")

    /*
     * Nothing else on this screen is a heading, so a heading that started at h2 would
     * leave the page with no h1 and skip a level for anyone navigating by heading.
     */
    const name = query(".notes-workspace__name", container)

    expect(name?.textContent?.trim()).toBe("Tags")
    expect(name?.tagName).toBe("H1")
    expect(queryAll("h1", container)).toHaveLength(1)
  })

  it("steps the tag heading down when the open note is the page's h1", async () => {
    await seedStorage(seed())

    const [first] = storedNotes()

    navigation.pathname.value = `/notes/${first?.id ?? "note-1"}`

    const container = await renderWithProviders(
      <NotesShell>
        <h1 className="visually-hidden">{first?.title}</h1>
      </NotesShell>,
    )

    await openTag(container, "work")

    expect(query(".notes-workspace__name", container)?.tagName).toBe("H2")
    expect(queryAll("h1", container)).toHaveLength(1)
  })

  it("reports a search inside the tag as a share of the tag", async () => {
    await seedStorage(seed())

    const container = await renderWithProviders(listUi())

    await openTag(container, "work")
    await type(await openSearch(container), "release")

    expect(renderedTitles(container)).toEqual(["Alpha"])
    expect(workspaceName(container)).toBe("Tags")
    expect(workspaceCount(container)).toBe("1 of 2 notes")
  })

  it("explains an empty result rather than showing a bare list", async () => {
    await seedStorage(seed())

    const container = await renderWithProviders(listUi())

    await openTag(container, "work")
    await type(await openSearch(container), "nothing matches this")

    expect(query(".notes-empty__title", container)?.textContent?.trim()).toBe(
      "No notes found.",
    )
    expect(workspaceCount(container)).toBe("0 of 2 notes")
  })

  it("steps back out to every note through All Tags", async () => {
    await seedStorage(seed())

    const container = await renderWithProviders(listUi())

    await openTag(container, "ideas")

    expect(renderedTitles(container)).toEqual(["Beta", "Gamma"])

    await selectValue(tagFilter(container), "")

    expect(renderedTitles(container)).toEqual(["Alpha", "Beta", "Gamma"])
    expect(workspaceName(container)).toBe("Tags")
    expect(workspaceCount(container)).toBe("3 notes")
  })

  it("still selects, selects all, and bulk deletes inside a tag", async () => {
    await seedStorage(seed())

    const container = await renderWithProviders(listUi())

    await openTag(container, "work")
    await click(checkbox("Select all", container) as HTMLInputElement)

    expect(query(".notes-selection__count", container)?.textContent?.trim()).toBe(
      "2 selected",
    )

    await click(byLabelText("Delete selected", container) as HTMLElement)
    await click(byLabelText("Delete", document) as HTMLElement)

    // Only the tagged notes went: the note in another tag is untouched.
    expect(storedNotes().map((note) => note.title)).toEqual(["Gamma"])
    expect(workspaceName(container)).toBe("Tags")
    expect(workspaceCount(container)).toBe("0 notes")
  })

  it("leaves a tag that has no notes behind without breaking the view", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta", tags: ["ideas"] }),
    ])

    const container = await renderWithProviders(listUi())

    await openTag(container, "work")

    // Renaming a tag out of the last note carrying it leaves the header behind.
    await click(byLabelText("Delete Alpha", container) as HTMLElement)
    await click(byLabelText("Delete", document) as HTMLElement)

    expect(renderedTitles(container)).toEqual([])
    expect(query(".notes-empty__title", container)?.textContent?.trim()).toBe(
      "No notes tagged #work.",
    )
    expect(workspaceName(container)).toBe("Tags")
  })
})