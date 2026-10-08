// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { PersonalizeDialog } from "@/components/theme/personalize-dialog"
import { DeleteNoteDialog } from "@/components/notes/delete-note-dialog"
import { NoteEditor } from "@/components/editor/note-editor"
import { NotesShell } from "@/components/shell/notes-shell"
import { HomeView } from "@/components/home/home-view"
import { makeNote, resetNoteIds } from "@/lib/notes/__tests__/note-factory"
import type { Note } from "@/types/note"

import { byLabelText, checkbox, click, query, selectValue, unmountAll } from "./test-render"

import { renderWithProviders, clearStorage, seedStorage } from "./test-harness"

import { audit, describeViolations } from "./axe-audit"

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

beforeAll(() => {
  /*
   * jsdom has no layout, so a range there cannot say where it is on the page. Opening
   * the expanded writing window puts the caret in the document, and jsdom answers that
   * focus with a selectionchange that lands while the audit is still running. ProseMirror
   * then scrolls the caret into view, which asks a range where it is. The honest answer
   * here is "nowhere", and a measurement that says so is one the view can carry on from,
   * where a missing method is an exception thrown from inside the editor and reported as
   * an unhandled error.
   */
  const nowhere: DOMRect = {
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }

  for (const target of [Range.prototype, Element.prototype] as const) {
    Object.defineProperty(target, "getClientRects", {
      configurable: true,
      value: () => [] as DOMRect[],
    })

    Object.defineProperty(target, "getBoundingClientRect", {
      configurable: true,
      value: () => nowhere,
    })
  }
})

function editorUi(note: Note) {
  return (
    <NotesShell>
      <NoteEditor
        note={note}
        deleteControl={<button type="button">Delete</button>}
      />
    </NotesShell>
  )
}

describe("axe audit", () => {
  it("has no violations on the populated notes list", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", content: "# Alpha\n\nBody text.", tags: ["work"] }),
      makeNote({ title: "Beta", isPinned: true }),
    ])

    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations on the empty notes list", async () => {
    await seedStorage([])

    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations with the tags panel expanded", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work", "ideas"] }),
    ])

    const container = await renderWithProviders(
      <NotesShell>{null}</NotesShell>,
    )

    await click(byLabelText("Tags", container) as HTMLElement)

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations with the search field expanded", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(
      <NotesShell>{null}</NotesShell>,
    )

    await click(byLabelText("Search notes", container) as HTMLElement)

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations on the editor in edit mode", async () => {
    await seedStorage([makeNote({ title: "Alpha", content: "Body **text**." })])

    const note = makeNote({ title: "Alpha", content: "Body **text**." })
    const container = await renderWithProviders(editorUi(note))

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations on the editor in preview mode", async () => {
    const note = makeNote({
      title: "Alpha",
      content: "# Heading\n\n- one\n- two\n\n> quote\n\n`code`",
    })

    await seedStorage([note])

    const container = await renderWithProviders(editorUi(note))

    await click(document.querySelector<HTMLElement>(
      '[role="tab"]',
    ) as HTMLElement)

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations on the editor with the writing window open", async () => {
    const note = makeNote({ title: "Alpha", content: "Body **text**." })

    await seedStorage([note])

    const container = await renderWithProviders(editorUi(note))

    await click(byLabelText("Expand writing area", container) as HTMLElement)

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations on the delete confirmation", async () => {
    const note = makeNote({ title: "Alpha" })

    await seedStorage([note])

    const container = await renderWithProviders(
      <DeleteNoteDialog
        note={note}
        isOpen
        onCancel={() => {}}
        onConfirm={async () => {}}
      />,
    )

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations on the personalize dialog", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(
      <PersonalizeDialog isOpen onClose={() => {}} />,
    )

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations inside a tag workspace", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta", tags: ["work", "ideas"] }),
    ])

    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(byLabelText("Tags", container) as HTMLElement)

    const filter = query(
      "select.notes-workspace__filter",
      container,
    ) as HTMLSelectElement

    await selectValue(filter, "work")

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations with notes selected", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta" }),
    ])

    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(checkbox("Select all", container) as HTMLInputElement)

    /*
     * The selection bar replaces the search field with bulk actions, so it is a
     * different screen from the plain list and has to pass on its own.
     */
    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations with the export menu open", async () => {
    const note = makeNote({ title: "Alpha", content: "# Alpha\n\nBody text." })

    await seedStorage([note])

    const container = await renderWithProviders(editorUi(note))

    await click(byLabelText("Export", container) as HTMLElement)

    expect(describeViolations(await audit(container))).toBe("")
  })

  it("has no violations on the home page", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", isPinned: true, tags: ["work"] }),
      makeNote({ title: "Beta", tags: ["work", "ideas"] }),
    ])

    const container = await renderWithProviders(<HomeView />)

    expect(describeViolations(await audit(container))).toBe("")
  })
})