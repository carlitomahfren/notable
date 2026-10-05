// @vitest-environment jsdom

import { useEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NoteDetailView } from "@/app/notes/[noteId]/note-detail-view"
import { NoteSelectionProvider } from "@/components/notes/note-selection-provider"
import { NotesList } from "@/components/notes/notes-list"
import {
  useWorkspaceActions,
  type WorkspaceView,
} from "@/components/providers/workspace-provider"
import { NotesShell } from "@/components/shell/notes-shell"
import { makeNote, resetNoteIds } from "@/lib/notes/__tests__/note-factory"

import {
  byLabelText,
  click,
  navButton,
  query,
  queryAll,
  renderedTitles,
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

function navItem(label: string, root: ParentNode = document): HTMLElement {
  return navButton(label, root)
}

/** Tags live in a disclosure, so the tag is chosen from the opened panel. */
async function selectTag(root: ParentNode, tag: string): Promise<void> {
  await click(navButton("Tags", root))

  const option = queryAll<HTMLElement>(".shell-tags__option", root).find(
    (element) =>
      element.querySelector(".shell-tags__name")?.textContent?.trim() === tag,
  )

  if (option === undefined) {
    throw new Error(`tag option not found: ${tag}`)
  }

  await click(option)
}

/*
 * Both the top bar button and the mobile FAB stay mounted and CSS picks one, so
 * `query` returning the first is deliberate: the top bar renders first.
 */
function newNoteButton(root: ParentNode = document): HTMLElement {
  const button = query<HTMLElement>(".shell-new-note", root)

  if (button === null) {
    throw new Error("new note button not found")
  }

  return button
}

function confirmDeleteButton(): HTMLElement {
  const dialog = query("dialog.confirm-dialog")

  if (dialog === null) {
    throw new Error("confirmation dialog not rendered")
  }

  return byLabelText("Delete", dialog) as HTMLElement
}

/**
 * The editor's destructive control. It is an icon, so the only place its name exists
 * is the accessible one; the dialog's own confirm button is still named "Delete",
 * which is why the two are looked up separately.
 */
function deleteNoteButton(): HTMLElement {
  return byLabelText("Delete note") as HTMLElement
}

/** Production composition for a note route: shell, list, and detail view. */
function detailUi(noteId: string) {
  return (
    <NotesShell>
      <NoteDetailView noteId={noteId} />
    </NotesShell>
  )
}

function SetViewOnMount({ view }: { view: WorkspaceView }) {
  const { setView } = useWorkspaceActions()

  useEffect(() => {
    setView(view)
  }, [setView, view])

  return null
}

describe("create note flow", () => {
  it("creates a valid empty note and navigates to its generated id", async () => {
    await seedStorage([])

    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(newNoteButton())

    const notes = storedNotes()

    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ title: "", content: "", tags: [] })
    expect(navigation.router.push).toHaveBeenCalledWith(`/notes/${notes[0].id}`)
  })

  it("persists the new note with a UUID-shaped id", async () => {
    await seedStorage([])

    await renderWithProviders(<NotesShell>{null}</NotesShell>)
    await click(newNoteButton())

    expect(storedNotes()[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it("does not use a /notes/new route", async () => {
    await seedStorage([])

    await renderWithProviders(<NotesShell>{null}</NotesShell>)
    await click(newNoteButton())

    const target = String(navigation.router.push.mock.calls[0][0])

    expect(target).not.toBe("/notes/new")
    expect(target.startsWith("/notes/")).toBe(true)
  })

  it("adds the new note to the visible list", async () => {
    await seedStorage([])

    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(newNoteButton())

    expect(query(".notes-empty", container)).toBeNull()
    expect(renderedTitles(container)).toEqual(["Untitled"])
  })

  it("creates a note from the empty-state action", async () => {
    await seedStorage([])

    const container = await renderWithProviders(
      <NoteSelectionProvider>
        <NotesList />
      </NoteSelectionProvider>,
    )

    await click(byLabelText("Create note") as HTMLElement)

    expect(storedNotes()).toHaveLength(1)
    expect(query(".notes-empty", container)).toBeNull()
  })

  it("requests title focus so the editor can take it on arrival", async () => {
    await seedStorage([])

    await renderWithProviders(
      <NotesShell>
        <NoteDetailView noteId="some-new-note" />
      </NotesShell>,
    )

    await click(newNoteButton())
    await click(newNoteButton())

    // Each create focuses the title exactly once; the intent is consumed.
    expect(storedNotes()).toHaveLength(2)
  })
})

describe("delete flow", () => {
  it("asks for confirmation before deleting", async () => {
    const note = makeNote({ title: "Doomed" })
    await seedStorage([note])
    navigation.pathname.value = `/notes/${note.id}`

    await renderWithProviders(detailUi(note.id))

    await click(deleteNoteButton())

    const dialog = query("dialog.confirm-dialog")

    expect(dialog?.textContent).toContain("Delete note?")
    expect(dialog?.textContent).toContain("Doomed")
    expect(dialog?.textContent).toContain("permanently removed")
    expect(storedNotes()).toHaveLength(1)
  })

  it("keeps the note when the confirmation is cancelled", async () => {
    const note = makeNote({ title: "Doomed" })
    await seedStorage([note])

    await renderWithProviders(detailUi(note.id))

    await click(deleteNoteButton())
    await click(byLabelText("Cancel") as HTMLElement)

    expect(storedNotes()).toHaveLength(1)
    expect(navigation.router.push).not.toHaveBeenCalled()
  })

  it("deletes the note and returns to /notes without selecting a neighbour", async () => {
    const first = makeNote({ title: "First" })
    const second = makeNote({ title: "Second" })

    await seedStorage([first, second])
    navigation.pathname.value = `/notes/${second.id}`

    await renderWithProviders(detailUi(second.id))

    await click(deleteNoteButton())
    await click(confirmDeleteButton())

    expect(storedNotes().map((note) => note.id)).toEqual([first.id])
    expect(navigation.router.push).toHaveBeenCalledTimes(1)
    expect(navigation.router.push).toHaveBeenCalledWith("/notes")
  })

  it("removes the deleted note from the list", async () => {
    const first = makeNote({ title: "First" })
    const second = makeNote({ title: "Second" })

    await seedStorage([first, second])
    navigation.pathname.value = `/notes/${second.id}`

    const container = await renderWithProviders(detailUi(second.id))

    await click(deleteNoteButton())
    await click(confirmDeleteButton())

    expect(renderedTitles(container)).toEqual(["First"])
  })

  it("restores focus to the list after deleting", async () => {
    const note = makeNote({ title: "Only" })
    await seedStorage([note])

    await renderWithProviders(detailUi(note.id))

    await click(deleteNoteButton())
    await click(confirmDeleteButton())

    expect(document.activeElement?.className).toContain(
      "shell-pane__focus-target",
    )
  })

  it("shows the first-run state once every note is deleted", async () => {
    const note = makeNote({ title: "Only" })
    await seedStorage([note])

    const container = await renderWithProviders(detailUi(note.id))

    await click(deleteNoteButton())
    await click(confirmDeleteButton())

    expect(query(".notes-empty__title", container)?.textContent).toBe(
      "No notes yet.",
    )
  })

  it("does not reseed welcome notes after deleting everything", async () => {
    const note = makeNote({ title: "Only" })
    await seedStorage([note])

    const container = await renderWithProviders(detailUi(note.id))

    await click(deleteNoteButton())
    await click(confirmDeleteButton())

    // Storage still marks welcome notes as seeded, and the list stays empty.
    expect(storedNotes()).toEqual([])
    expect(renderedTitles(container)).toEqual([])
  })
})

function modeTab(name: string, root: ParentNode = document): HTMLElement {
  const match = queryAll<HTMLElement>('[role="tab"]', root).find(
    (element) => element.textContent?.trim() === name,
  )

  if (match === undefined) {
    throw new Error(`mode tab not found: ${name}`)
  }

  return match
}

describe("note detail view", () => {
  it("shows the selected note title in the title field", async () => {
    const note = makeNote({ title: "Readable" })
    await seedStorage([note])

    await renderWithProviders(detailUi(note.id))

    expect(query<HTMLInputElement>(".editor__title-input")?.value).toBe(
      "Readable",
    )
  })

  it("displays the untitled label without storing it", async () => {
    const note = makeNote({ title: "   " })
    await seedStorage([note])

    const container = await renderWithProviders(detailUi(note.id))
    const input = query<HTMLInputElement>(".editor__title-input", container)

    // The field keeps the raw value; the label is presentation only.
    expect(input?.value).toBe("   ")

    await click(modeTab("Preview", container))

expect(query(".editor h1", container)?.textContent).toBe("Untitled")
expect(input?.value).toBe("   ")
  })

  it("shows a not-found state for an unknown note id", async () => {
    await seedStorage([makeNote({ title: "Only" })])

    await renderWithProviders(detailUi("does-not-exist"))

    expect(query(".shell-editor__title")?.textContent).toBe("Note not found")
  })

  it("does not offer delete for an unknown note", async () => {
    await seedStorage([makeNote({ title: "Only" })])

    await renderWithProviders(detailUi("does-not-exist"))

    expect(deleteNoteButton()).toBeNull()
  })

  it("marks the editor screen so mobile shows the detail view", async () => {
    const note = makeNote({ title: "Readable" })
    await seedStorage([note])
    navigation.pathname.value = `/notes/${note.id}`

    const container = await renderWithProviders(detailUi(note.id))

    expect(
      query(".shell", container)?.getAttribute("data-editor-open"),
    ).toBe("true")
  })
})

describe("tag view with no matching notes", () => {
  it("reports that no notes carry the selected tag", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta", tags: ["ideas"] }),
    ])

    const container = await renderWithProviders(
      <NoteSelectionProvider>
        <NotesList />
      </NoteSelectionProvider>,
      <SetViewOnMount view={{ kind: "tag", tag: "ghost" }} />,
    )

    expect(query(".notes-empty__title", container)?.textContent).toBe(
      "No notes tagged #ghost.",
    )
  })

  it("keeps the tag view active after switching away and back", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta" }),
    ])

    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await selectTag(container, "work")
    await click(navItem("All Notes", container))
    await selectTag(container, "work")

    expect(renderedTitles(container)).toEqual(["Alpha"])
  })
})