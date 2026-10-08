// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NoteDetailView } from "@/app/notes/[noteId]/note-detail-view"
import { NotesShell } from "@/components/shell/notes-shell"
import { makeNote, resetNoteIds } from "@/lib/notes/__tests__/note-factory"
import { NOTES_STORAGE_KEY } from "@/lib/notes/notes-repository"

import {
  byLabelText,
  checkbox,
  click,
  navButton,
  query,
  queryAll,
  renderedTitles,
  selectTag,
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
  vi.restoreAllMocks()
})

function listUi() {
  return <NotesShell>{null}</NotesShell>
}

/** The dialog the list raises, whether for one card or for the selection. */
function confirmation(container: ParentNode = document): HTMLElement {
  const dialog = query<HTMLElement>("dialog.confirm-dialog", container)

  if (dialog === null) {
    throw new Error("confirmation dialog not rendered")
  }

  return dialog
}

async function confirm(): Promise<void> {
  await click(byLabelText("Delete", confirmation()) as HTMLElement)
}

function cancel(): Promise<void> {
  return click(byLabelText("Cancel", confirmation()) as HTMLElement)
}

function cardAction(name: string, container: ParentNode = document): HTMLElement {
  const button = byLabelText(name, container)

  if (button === null) {
    throw new Error(`card action not found: ${name}`)
  }

  return button
}

function selectionCount(container: ParentNode = document): string {
  return (
    query(".notes-selection__count", container)?.textContent?.trim() ?? ""
  )
}

async function openSearch(container: HTMLElement): Promise<HTMLInputElement> {
  await click(byLabelText("Search notes", container) as HTMLElement)

  const input = container.querySelector<HTMLInputElement>('input[type="search"]')

  if (input === null) {
    throw new Error("search input not found")
  }

  return input
}

describe("delete from a note card", () => {
  it("asks for confirmation before deleting", async () => {
    const alpha = makeNote({ title: "Alpha" })
    await seedStorage([alpha, makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(cardAction("Delete Alpha", container))

    const dialog = confirmation(container)

    expect(dialog.textContent).toContain("Alpha")
    expect(dialog.textContent).toContain("permanently removed")
    expect(storedNotes()).toHaveLength(2)
  })

  it("keeps the note when the confirmation is cancelled", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    await click(cardAction("Delete Alpha", container))
    await cancel()

    expect(storedNotes()).toHaveLength(1)
    expect(renderedTitles(container)).toEqual(["Alpha"])
  })

  it("removes the note from the list once confirmed", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(cardAction("Delete Alpha", container))
    await confirm()

    expect(storedNotes().map((note) => note.title)).toEqual(["Beta"])
    expect(renderedTitles(container)).toEqual(["Beta"])
  })

  it("does not open or select the note it deletes", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(cardAction("Delete Alpha", container))
    await cancel()

    expect(navigation.router.push).not.toHaveBeenCalled()
    expect(navigation.pathname.value).toBe("/notes")
    expect(selectionCount(container)).toBe("2 notes")
  })

  it("leaves the route alone when the deleted note is not the open one", async () => {
    const alpha = makeNote({ title: "Alpha" })
    await seedStorage([alpha, makeNote({ title: "Beta" })])
    navigation.pathname.value = `/notes/${alpha.id}`

    await renderWithProviders(listUi())

    await click(cardAction("Delete Beta"))
    await confirm()

    expect(navigation.router.push).not.toHaveBeenCalled()
  })

  it("returns to the list without a neighbour when the open note is deleted", async () => {
    const alpha = makeNote({ title: "Alpha" })
    const beta = makeNote({ title: "Beta" })
    await seedStorage([alpha, beta])
    navigation.pathname.value = `/notes/${alpha.id}`

    const container = await renderWithProviders(listUi())

    await click(cardAction("Delete Alpha", container))
    await confirm()

    expect(navigation.router.push).toHaveBeenCalledTimes(1)
    expect(navigation.router.push).toHaveBeenCalledWith("/notes")
    expect(
      queryAll(".note-card[aria-current='page']", container),
    ).toHaveLength(0)
  })

  it("disables both card actions while the note's delete is in flight", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(cardAction("Delete Alpha", container))

    expect(cardAction("Delete Alpha", container).hasAttribute("disabled")).toBe(
      true,
    )
  })
})

describe("selecting notes", () => {
  it("ticks and unticks a single note", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    const tick = checkbox("Select Alpha", container) as HTMLInputElement

    await click(tick)

    expect(tick.checked).toBe(true)
    expect(selectionCount(container)).toBe("1 selected")

    await click(checkbox("Deselect Alpha", container) as HTMLInputElement)

    expect(selectionCount(container)).toBe("2 notes")
    expect(byLabelText("Delete selected", container)).toBeNull()
  })

  it("selects exactly the visible notes with select all", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
      makeNote({ title: "Gamma" }),
    ])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select all", container) as HTMLInputElement)

    expect(selectionCount(container)).toBe("3 selected")
    expect(
      queryAll<HTMLInputElement>(
        ".note-card__select-input:checked",
        container,
      ),
    ).toHaveLength(3)
  })

  it("selects only what a search leaves visible", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
      makeNote({ title: "Gamma" }),
    ])

    const container = await renderWithProviders(listUi())

    await type(await openSearch(container), "alpha")
    await click(checkbox("Select all", container) as HTMLInputElement)

    expect(renderedTitles(container)).toEqual(["Alpha"])
    expect(selectionCount(container)).toBe("1 selected")
    expect(
      queryAll<HTMLInputElement>(".note-card__select-input:checked", container),
    ).toHaveLength(1)
  })

  it("treats what a search leaves as the whole selection", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
      makeNote({ title: "Gamma" }),
    ])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select all", container) as HTMLInputElement)
    await type(await openSearch(container), "alpha")

    /*
     * Every visible note is ticked, so the select all is checked even though it only
     * ever saw one note. A second press is a clear, which takes the whole selection
     * with it: the filter decides what the row acts on, it does not create a second
     * selection behind the first.
     */
    expect((checkbox("Select all", container) as HTMLInputElement).checked).toBe(
      true,
    )

    await click(checkbox("Select all", container) as HTMLInputElement)

    expect(selectionCount(container)).toBe("1 note")
    expect(byLabelText("Delete selected", container)).toBeNull()
  })

  it("selects only what the pinned view leaves visible", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", isPinned: true }),
      makeNote({ title: "Beta" }),
    ])

    const container = await renderWithProviders(listUi())

    await click(navButton("Pinned") as HTMLElement)
    await click(checkbox("Select all", container) as HTMLInputElement)

    expect(renderedTitles(container)).toEqual(["Alpha"])
    expect(selectionCount(container)).toBe("1 selected")
    expect(
      queryAll<HTMLInputElement>(".note-card__select-input:checked", container),
    ).toHaveLength(1)
  })

  it("selects only what the active tag view leaves visible", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta", tags: ["work"] }),
      makeNote({ title: "Gamma", tags: ["ideas"] }),
    ])

    const container = await renderWithProviders(listUi())

    await selectTag("work")
    await click(checkbox("Select all", container) as HTMLInputElement)

    expect(renderedTitles(container)).toEqual(["Alpha", "Beta"])
    expect(selectionCount(container)).toBe("2 selected")
    expect(
      queryAll<HTMLInputElement>(".note-card__select-input:checked", container),
    ).toHaveLength(2)
  })

  it("keeps a selection made before the filter changed", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta", tags: ["work"] }),
      makeNote({ title: "Gamma", tags: ["ideas"] }),
    ])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select Gamma", container) as HTMLInputElement)
    await selectTag("work")

    expect(selectionCount(container)).toBe("1 selected")
  })

  it("clears the selection when select all is used on a full selection", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select all", container) as HTMLInputElement)
    await click(checkbox("Select all", container) as HTMLInputElement)

    expect(selectionCount(container)).toBe("2 notes")
    expect((checkbox("Select all", container) as HTMLInputElement).checked).toBe(
      false,
    )
    expect(
      queryAll<HTMLInputElement>(".note-card__select-input:checked", container),
    ).toHaveLength(0)
    // The row is back to the count it started as.
    expect(byLabelText("Clear", container)).toBeNull()
    expect(byLabelText("Delete selected", container)).toBeNull()
  })

  it("clears the selection on demand", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select Alpha", container) as HTMLInputElement)
    await click(checkbox("Select Beta", container) as HTMLInputElement)
    await click(byLabelText("Clear", container) as HTMLElement)

    expect(selectionCount(container)).toBe("2 notes")
    expect(
      queryAll<HTMLInputElement>(".note-card__select-input:checked", container),
    ).toHaveLength(0)
    expect(byLabelText("Clear", container)).toBeNull()
    expect(byLabelText("Delete selected", container)).toBeNull()
    // The button that was pressed is gone, so focus has to land somewhere real.
    expect(document.activeElement).toBe(checkbox("Select all", container))
  })

  /*
   * Two permanently inert buttons are a row of weight the reader never asked for, and
   * all they can do at rest is refuse. The actions arrive with the first tick instead.
   */
  it("shows only the select all until something is ticked", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
      makeNote({ title: "Gamma" }),
    ])

    const container = await renderWithProviders(listUi())
    const selectAll = checkbox("Select all", container) as HTMLInputElement

    expect(selectAll.checked).toBe(false)
    expect(selectAll.indeterminate).toBe(false)
    expect(selectionCount(container)).toBe("3 notes")
    expect(byLabelText("Clear", container)).toBeNull()
    expect(byLabelText("Delete selected", container)).toBeNull()
  })

  it("brings the actions in as soon as one note is ticked", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
      makeNote({ title: "Gamma" }),
    ])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select Alpha", container) as HTMLInputElement)

    const selectAll = checkbox("Select all", container) as HTMLInputElement

    expect(selectionCount(container)).toBe("1 selected")
    expect(selectAll.checked).toBe(false)
    expect(selectAll.indeterminate).toBe(true)
    expect(byLabelText("Clear", container)).not.toBeNull()
    expect(byLabelText("Delete selected", container)).not.toBeNull()
  })

  it("counts every visible note once they are all ticked", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
      makeNote({ title: "Gamma" }),
    ])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select all", container) as HTMLInputElement)

    const selectAll = checkbox("Select all", container) as HTMLInputElement

    expect(selectionCount(container)).toBe("3 selected")
    expect(selectAll.checked).toBe(true)
    expect(selectAll.indeterminate).toBe(false)
    expect(byLabelText("Clear", container)).not.toBeNull()
    expect(byLabelText("Delete selected", container)).not.toBeNull()
  })

  it("offers no select all when no note is visible", async () => {
    await seedStorage([])

    const container = await renderWithProviders(listUi())

    expect(query(".notes-selection", container)).toBeNull()
    expect(checkbox("Select all", container)).toBeNull()
  })

  it("keeps the selection out of the notes it applies to", async () => {
    const seeded = [makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })]
    await seedStorage(seeded)

    const before = localStorage.getItem(NOTES_STORAGE_KEY)

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select all", container) as HTMLInputElement)
    await click(byLabelText("Clear", container) as HTMLElement)

    expect(localStorage.getItem(NOTES_STORAGE_KEY)).toBe(before)
  })

  it("marks a ticked card by state as well as by surface", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select Alpha", container) as HTMLInputElement)

    expect(
      query(".note-card__item", container)?.getAttribute("data-selected"),
    ).toBe("true")
  })

  it("reports a mixed selection as neither ticked nor empty", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select Alpha", container) as HTMLInputElement)

    expect((checkbox("Select all", container) as HTMLInputElement).indeterminate).toBe(
      true,
    )

    await click(checkbox("Select Beta", container) as HTMLInputElement)

    expect((checkbox("Select all", container) as HTMLInputElement).indeterminate).toBe(
      false,
    )
  })
})

describe("deleting a selection", () => {
  it("states how many notes are about to go", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
      makeNote({ title: "Gamma" }),
    ])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select Alpha", container) as HTMLInputElement)
    await click(checkbox("Select Beta", container) as HTMLInputElement)
    await click(byLabelText("Delete selected", container) as HTMLElement)

    const dialog = confirmation(container)

    expect(dialog.textContent).toContain("Delete 2 notes?")
    expect(dialog.textContent).toContain("permanently removed")
    expect(storedNotes()).toHaveLength(3)
  })

  it("deletes the selected notes and leaves the rest", async () => {
    await seedStorage([
      makeNote({ title: "Alpha" }),
      makeNote({ title: "Beta" }),
      makeNote({ title: "Gamma" }),
    ])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select Alpha", container) as HTMLInputElement)
    await click(checkbox("Select Beta", container) as HTMLInputElement)
    await click(byLabelText("Delete selected", container) as HTMLElement)
    await confirm()

    expect(storedNotes().map((note) => note.title)).toEqual(["Gamma"])
    expect(renderedTitles(container)).toEqual(["Gamma"])
    expect(selectionCount(container)).toBe("1 note")
  })

  it("keeps the notes when the deletion is cancelled", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select all", container) as HTMLInputElement)
    await click(byLabelText("Delete selected", container) as HTMLElement)
    await cancel()

    expect(storedNotes()).toHaveLength(2)
    expect(selectionCount(container)).toBe("2 selected")
  })

  it("empties the list without reseeding when everything is deleted", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select all", container) as HTMLInputElement)
    await click(byLabelText("Delete selected", container) as HTMLElement)
    await confirm()

    expect(storedNotes()).toEqual([])
    expect(query(".notes-empty__title", container)?.textContent).toBe(
      "No notes yet.",
    )
  })

  it("keeps the view and search that produced the selection", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta", tags: ["work"] }),
      makeNote({ title: "Gamma", tags: ["ideas"] }),
    ])

    const container = await renderWithProviders(listUi())

    await selectTag("work")
    await click(checkbox("Select all", container) as HTMLInputElement)
    await click(byLabelText("Delete selected", container) as HTMLElement)
    await confirm()

    // The tag view is still the one in force, so the gap it opened reads as empty.
    expect(query(".notes-empty__title", container)?.textContent).toBe(
      "No notes tagged #work.",
    )
  })

  it("does not write the selection into storage", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select all", container) as HTMLInputElement)
    await click(byLabelText("Delete selected", container) as HTMLElement)
    await confirm()

    expect(localStorage.getItem(NOTES_STORAGE_KEY)).not.toContain("selected")
  })

  it("keeps the selection and reports the failure when a delete fails", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    const container = await renderWithProviders(listUi())

    await click(checkbox("Select all", container) as HTMLInputElement)

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is full")
    })

    await click(byLabelText("Delete selected", container) as HTMLElement)
    await confirm()

    const dialog = confirmation(container)

    expect(dialog.textContent).toContain("storage is full")
    expect(storedNotes()).toHaveLength(2)
    expect(selectionCount(container)).toBe("2 selected")
  })

  it("restores focus to the list once the deletion lands", async () => {
    await seedStorage([makeNote({ title: "Alpha" }), makeNote({ title: "Beta" })])

    await renderWithProviders(listUi())

    await click(checkbox("Select all") as HTMLInputElement)
    await click(byLabelText("Delete selected") as HTMLElement)
    await confirm()

    expect(document.activeElement?.className).toContain(
      "shell-pane__focus-target",
    )
  })
})

describe("note editor route", () => {
  it("offers no way back to the list", async () => {
    const note = makeNote({ title: "Readable" })
    await seedStorage([note])
    navigation.pathname.value = `/notes/${note.id}`

    const container = await renderWithProviders(
      <NotesShell>
        <NoteDetailView noteId={note.id} />
      </NotesShell>,
    )

    expect(query(".shell-back-link", container)).toBeNull()
    expect(container.textContent).not.toContain("Back to notes")
  })

  it("keeps the delete control at the end of the note", async () => {
    const note = makeNote({ title: "Readable" })
    await seedStorage([note])

    const container = await renderWithProviders(
      <NotesShell>
        <NoteDetailView noteId={note.id} />
      </NotesShell>,
    )

    const editor = query(".editor", container) as HTMLElement
    const footer = query(".editor__footer", container) as HTMLElement

    expect(editor.lastElementChild).toBe(footer)
    expect(footer.textContent).not.toContain("Readable")
    expect(byLabelText("Delete note", footer)).not.toBeNull()
  })
})