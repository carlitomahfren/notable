// @vitest-environment jsdom

import { act, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NoteDetailView } from "@/app/notes/[noteId]/note-detail-view"
import { makeNote, resetNoteIds } from "@/lib/notes/__tests__/note-factory"
import { NOTES_STORAGE_KEY } from "@/lib/notes/notes-repository"
import type { Note } from "@/types/note"

import {
  byLabelText,
  click,
  clearNote,
  editorFor,
  editorMarkdown,
  flush,
  proseElement,
  query,
  queryAll,
  selectFirstParagraph,
  type,
  typeInNote,
  unmountAll,
} from "@/components/notes/__tests__/test-render"

import {
  clearStorage,
  renderWithProviders,
  seedStorage,
  storedNotes,
} from "@/components/notes/__tests__/test-harness"

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
  vi.useFakeTimers()
  clearStorage()
  resetNoteIds()
  navigation.pathname.value = "/notes"
  navigation.router.push.mockClear()
})

afterEach(async () => {
  await unmountAll()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

  await flush(4)
}

async function typeInto(
  element: HTMLInputElement,
  value: string,
): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set

  await act(async () => {
    setter?.call(element, value)
    element.dispatchEvent(new Event("input", { bubbles: true }))
  })

  await flush(4)
}

async function pressKey(
  element: Element,
  key: string,
  init: KeyboardEventInit = {},
): Promise<void> {
  await act(async () => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    )
  })

  await flush(4)
}

function titleInput(root: ParentNode = document): HTMLInputElement {
  const input = query<HTMLInputElement>(".editor__title-input", root)

  if (input === null) {
    throw new Error("title input not found")
  }

  return input
}

function tagInput(root: ParentNode = document): HTMLInputElement {
  const input = query<HTMLInputElement>(".editor-tags__input", root)

  if (input === null) {
    throw new Error("tag input not found")
  }

  return input
}

function modeTab(name: string, root: ParentNode = document): HTMLElement {
  const match = queryAll<HTMLElement>('[role="tab"]', root).find(
    (element) => element.textContent?.trim() === name,
  )

  if (match === undefined) {
    throw new Error(`mode tab not found: ${name}`)
  }

  return match
}

function tagChips(root: ParentNode = document): string[] {
  return queryAll(".editor-tags__name", root).map(
    (chip) => chip.textContent?.replace(/^#/, "") ?? "",
  )
}

function saveState(root: ParentNode = document): string | null {
  return query(".editor-save-status", root)?.getAttribute("data-state") ?? null
}

function saveLabel(root: ParentNode = document): string {
  return (
    query(".editor-save-status__label", root)?.textContent?.trim() ?? ""
  )
}

function savedNote(id: string): Note {
  const note = storedNotes().find((candidate) => candidate.id === id)

  if (note === undefined) {
    throw new Error(`note not found in storage: ${id}`)
  }

  return note
}

async function openNote(note: Note) {
  navigation.pathname.value = `/notes/${note.id}`

  return renderWithProviders(<NoteDetailView noteId={note.id} />)
}

describe("title editing", () => {
  it("marks the note as having unsaved changes while typing", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)

    expect(saveState()).toBe("saved")
    expect(saveLabel()).toBe("Saved")

    await typeInto(titleInput(), "Drafting")

    expect(saveState()).toBe("dirty")
    expect(saveLabel()).toBe("Unsaved changes")
  })

  it("autosaves the title after the debounce", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)
    await typeInto(titleInput(), "Final title")

    await advance(799)
    expect(savedNote(note.id).title).toBe("Draft")

    await advance(1)
    expect(savedNote(note.id).title).toBe("Final title")
    expect(saveState()).toBe("saved")
  })

  it("stores an empty title when the field is cleared completely", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)
    await typeInto(titleInput(), "")

    await advance(800)

    expect(savedNote(note.id).title).toBe("")
    expect(titleInput().value).toBe("")
  })

  it("advances updatedAt when the title changes", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)
    await typeInto(titleInput(), "Touched")
    await advance(800)

    expect(savedNote(note.id).updatedAt).not.toBe(note.updatedAt)
  })

  /*
   * What the save state says, and when it says it out loud.
   *
   * The label is the visible truth in all four states, and only the two settled
   * states are announced: a screen reader user typing would otherwise be interrupted
   * by "saving" after every keystroke, which is worse than saying nothing.
   */
  it("names every save state and announces only the settled ones", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)

    const announcement = () =>
      query(".editor-save-status .visually-hidden")?.textContent ?? ""

    expect(saveState()).toBe("saved")
    expect(saveLabel()).toBe("Saved")
    expect(announcement()).toBe("Saved.")

    await typeInto(titleInput(), "Drafting")

    expect(saveLabel()).toBe("Unsaved changes")
    expect(announcement()).toBe("")

    // The saving state exists in the interface even if the queue settles fast.
    expect(saveLabel()).not.toBe("Saving changes")
    expect(announcement()).toBe("")

    await advance(800)

    expect(saveState()).toBe("saved")
    expect(announcement()).toBe("Saved.")
  })

  it("pairs every save state with an icon rather than a colour", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)

    const iconCount = () =>
      queryAll(".editor-save-status svg", document).length

    expect(iconCount()).toBe(1)

    await typeInto(titleInput(), "Drafting")

    expect(iconCount()).toBe(1)
    expect(query(".editor-save-status")?.getAttribute("data-state")).toBe("dirty")
  })
})

/**
 * What the reader writes is what the note holds.
 *
 * The body is an editor rather than a field, so these tests type through the editor's
 * own commands and read the Markdown back out. They also assert the two things the
 * reader never sees but must not lose: the words come back as Markdown, and the page
 * draws the same note whether it is being written or read.
 */
describe("content editing", () => {
  it("autosaves what the reader wrote", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)
    await typeInNote("Body")

    await advance(800)

    expect(savedNote(note.id).content).toBe("Body")
  })

  it("stores a heading as the Markdown it was written as", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)

    /*
     * Stands in for what the browser does when a reader types "# ": the input rule turns
     * the line into a heading. jsdom cannot run that rule, so the heading is put into the
     * document the way the rule would have, and the Markdown is read back out.
     */
    await typeInNote("<h1>Heading</h1>")

    await advance(800)

    expect(savedNote(note.id).content).toBe("# Heading")
  })

  it("stores an empty body when the content is cleared", async () => {
    const note = makeNote({ title: "Draft", content: "old body" })
    await seedStorage([note])

    await openNote(note)
    await clearNote()

    await advance(800)

    expect(savedNote(note.id).content).toBe("")
  })

  it("draws the stored note in the read-only panel", async () => {
    const note = makeNote({ title: "Draft", content: "## Preview me" })
    await seedStorage([note])

    const container = await openNote(note)

    await click(modeTab("Preview", container))

    // The stored level is 2, drawn one down so the note's title keeps the page's h1.
    expect(query(".rich-text__prose h3", container)?.textContent).toBe(
      "Preview me",
    )
    expect(proseElement(container).getAttribute("contenteditable")).toBe("false")
  })

  it("applies toolbar formatting to the selected text", async () => {
    const note = makeNote({ title: "Draft", content: "select me" })
    await seedStorage([note])

    await openNote(note)

    await selectFirstParagraph()
    await click(byLabelText("Bold") as HTMLElement)

    expect(editorMarkdown()).toBe("**select me**")
  })

  it("saves formatted content", async () => {
    const note = makeNote({ title: "Draft", content: "select me" })
    await seedStorage([note])

    await openNote(note)

    await selectFirstParagraph()
    await click(byLabelText("Bold") as HTMLElement)
    await advance(800)

    expect(savedNote(note.id).content).toBe("**select me**")
  })

  it("never shows Markdown characters the reader did not write", async () => {
    const note = makeNote({ title: "Draft", content: "select me" })
    await seedStorage([note])

    await openNote(note)
    await selectFirstParagraph()
    await click(byLabelText("Bold") as HTMLElement)

    // The asterisks are the storage format, not something on the page.
    expect(proseElement().textContent).toBe("select me")
    expect(proseElement().innerHTML).toBe("<p><strong>select me</strong></p>")
  })
})

describe("tag editing", () => {
  it("adds a tag with Enter", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)

    const input = tagInput()
    await typeInto(input, "work")
    await pressKey(input, "Enter")

    expect(tagChips()).toEqual(["work"])

    await advance(800)

    expect(savedNote(note.id).tags).toEqual(["work"])
  })

  it("adopts the canonical tag returned by the service", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)

    const input = tagInput()
    await typeInto(input, "Work In Progress")
    await pressKey(input, "Enter")

    expect(tagChips()).toEqual(["Work In Progress"])

    await advance(800)

    // Lowercasing and whitespace collapsing belong to the service, not the UI.
    expect(tagChips()).toEqual(["work in progress"])
    expect(savedNote(note.id).tags).toEqual(["work in progress"])
  })

  it("adds several tags separated by commas", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)
    await typeInto(tagInput(), "alpha, beta")
    await pressKey(tagInput(), ",")

    expect(tagChips()).toEqual(["alpha", "beta"])

    await advance(800)

    expect(savedNote(note.id).tags).toEqual(["alpha", "beta"])
  })

  it("ignores blank entries", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)
    await typeInto(tagInput(), "   ")
    await pressKey(tagInput(), "Enter")

    expect(tagChips()).toEqual([])
  })

  it("removes a tag with its accessible remove button", async () => {
    const note = makeNote({ title: "Draft", tags: ["alpha", "beta"] })
    await seedStorage([note])

    await openNote(note)
    await click(byLabelText("Remove tag alpha") as HTMLElement)

    expect(tagChips()).toEqual(["beta"])

    await advance(800)

    expect(savedNote(note.id).tags).toEqual(["beta"])
  })

  it("removes the last tag with Backspace on an empty field", async () => {
    const note = makeNote({ title: "Draft", tags: ["alpha", "beta"] })
    await seedStorage([note])

    await openNote(note)
    await pressKey(tagInput(), "Backspace")

    expect(tagChips()).toEqual(["alpha"])
  })

  it("keeps Backspace usable for editing a pending entry", async () => {
    const note = makeNote({ title: "Draft", tags: ["alpha"] })
    await seedStorage([note])

    await openNote(note)

    const input = tagInput()
    await typeInto(input, "typing")
    await pressKey(input, "Backspace")

    expect(tagChips()).toEqual(["alpha"])
  })
})

describe("edit and preview modes", () => {
  it("exposes the active mode through aria-selected", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    expect(modeTab("Edit", container).getAttribute("aria-selected")).toBe("true")
    expect(modeTab("Preview", container).getAttribute("aria-selected")).toBe(
      "false",
    )

    await click(modeTab("Preview", container))

    expect(modeTab("Edit", container).getAttribute("aria-selected")).toBe("false")
    expect(modeTab("Preview", container).getAttribute("aria-selected")).toBe(
      "true",
    )
  })

  it("keeps one tab stop for the whole tablist", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    expect(modeTab("Edit", container).getAttribute("tabindex")).toBe("0")
    expect(modeTab("Preview", container).getAttribute("tabindex")).toBe("-1")
  })

  it("moves between modes with the arrow keys", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    await pressKey(modeTab("Edit", container), "ArrowRight")

    expect(modeTab("Preview", container).getAttribute("aria-selected")).toBe(
      "true",
    )
    expect(document.activeElement?.textContent?.trim()).toBe("Preview")

    await pressKey(modeTab("Preview", container), "Home")

    expect(modeTab("Edit", container).getAttribute("aria-selected")).toBe("true")
  })

  it("gives the one panel to the active mode", async () => {
    const note = makeNote({ title: "Draft", content: "body" })
    await seedStorage([note])

    const container = await openNote(note)

    /*
     * There is one panel rather than two. Edit and Preview show the same document, and a
     * second panel would mean a second rendering of the note for the two of them to
     * disagree about. Which mode owns the panel is what changes.
     */
    const panels = queryAll('[role="tabpanel"]', container)

    expect(panels).toHaveLength(1)
    expect(panels[0].className).toBe("editor__panel")
    expect(panels[0].id).toBe(modeTab("Edit", container).getAttribute("aria-controls"))

    await click(modeTab("Preview", container))

    const preview = query('[role="tabpanel"]', container) as HTMLElement

    expect(queryAll('[role="tabpanel"]', container)).toHaveLength(1)
    expect(preview.id).toBe(
      modeTab("Preview", container).getAttribute("aria-controls"),
    )
    expect(preview.className).toBe("editor__panel editor__panel--preview")
  })

  it("keeps the typed draft when switching modes", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)
    const editor = editorFor(container)

    await typeInNote("kept draft", container)

    await click(modeTab("Preview", container))
    await click(modeTab("Edit", container))

    // One editor across the switch is what leaves the words where they were.
    expect(editorFor(container)).toBe(editor)
    expect(editorMarkdown(container)).toBe("kept draft")
  })

  it("leaves the undo history alone when switching modes", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    await typeInNote("kept draft", container)

    await click(modeTab("Preview", container))
    await click(modeTab("Edit", container))

    const editor = editorFor(container)

    await act(async () => {
      editor.commands.undo()
    })

    await flush()

    expect(editorMarkdown(container)).toBe("")
  })

  it("does not persist again just for switching modes", async () => {
    const note = makeNote({ title: "Draft", content: "body" })
    await seedStorage([note])

    const container = await openNote(note)

    const writes: string[] = []
    const original = Storage.prototype.setItem
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === NOTES_STORAGE_KEY) {
          writes.push(value)
        }

        original.call(this, key, value)
      })

    await typeInNote("one change", container)
    await click(modeTab("Preview", container))
    await click(modeTab("Edit", container))
    await advance(1000)

    expect(writes).toHaveLength(1)

    spy.mockRestore()
  })
})

describe("autosave triggers", () => {
  it("flushes on blur instead of waiting for the debounce", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)
    await typeInto(titleInput(), "Blurred")

    await act(async () => {
      titleInput().focus()
      titleInput().blur()
    })

    await flush(8)

    expect(savedNote(note.id).title).toBe("Blurred")
  })

  it("flushes immediately on Ctrl+S", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    await openNote(note)
    await typeInNote("shortcut")

    await pressKey(document.body, "s", { ctrlKey: true })
    await flush(8)

    expect(savedNote(note.id).content).toBe("shortcut")
  })

  it("flushes a dirty draft when the editor unmounts", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    function ClosableEditor() {
      const [open, setOpen] = useState(true)

      return (
        <div>
          <button type="button" onClick={() => setOpen(false)}>
            Close editor
          </button>

          {open ? <NoteDetailView noteId={note.id} /> : null}
        </div>
      )
    }

    await renderWithProviders(<ClosableEditor />)

    await typeInNote("left behind")
    await click(byLabelText("Close editor") as HTMLElement)
    await flush(10)

    expect(savedNote(note.id).content).toBe("left behind")
  })

  it("saves the latest draft after a burst of fast edits", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)
    const editor = editorFor(container)

    for (const word of ["D", "Dr", "Dra", "Draf", "Draft"]) {
      await act(async () => {
        editor.commands.setContent(`<p>${word}</p>`)
      })

      await advance(100)
    }

    await advance(800)

    expect(savedNote(note.id).content).toBe("Draft")
  })
})

function SwitchableEditor({ notes }: { notes: Note[] }) {
  const [activeId, setActiveId] = useState(notes[0].id)

  return (
    <div>
      {notes.map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={() => setActiveId(note.id)}
        >
          {`Open ${note.title}`}
        </button>
      ))}

      <NoteDetailView noteId={activeId} />
    </div>
  )
}

describe("switching notes", () => {
  it("never shows one note's draft under another note", async () => {
    const first = makeNote({ title: "First", content: "first body" })
    const second = makeNote({ title: "Second", content: "second body" })
    await seedStorage([first, second])

    const container = await renderWithProviders(
      <SwitchableEditor notes={[first, second]} />,
    )

    expect(editorMarkdown(container)).toBe("first body")

    await typeInNote("edited first body", container)
    await click(byLabelText("Open Second") as HTMLElement)

    expect(editorMarkdown(container)).toBe("second body")
    expect(titleInput(container).value).toBe("Second")
  })

  it("gives each note its own editor rather than refilling one", async () => {
    const first = makeNote({ title: "First", content: "first body" })
    const second = makeNote({ title: "Second", content: "second body" })
    await seedStorage([first, second])

    const container = await renderWithProviders(
      <SwitchableEditor notes={[first, second]} />,
    )

    const firstEditor = editorFor(container)

    await click(byLabelText("Open Second") as HTMLElement)

    expect(editorFor(container)).not.toBe(firstEditor)
  })

  it("flushes the previous note's draft when switching away", async () => {
    const first = makeNote({ title: "First" })
    const second = makeNote({ title: "Second" })
    await seedStorage([first, second])

    const container = await renderWithProviders(
      <SwitchableEditor notes={[first, second]} />,
    )

    await typeInto(titleInput(container), "First edited")
    await click(byLabelText("Open Second") as HTMLElement)
    await advance(50)

    expect(savedNote(first.id).title).toBe("First edited")
    expect(savedNote(second.id).title).toBe("Second")
  })

  it("keeps edits separate per note across repeated switches", async () => {
    const first = makeNote({ title: "First" })
    const second = makeNote({ title: "Second" })
    await seedStorage([first, second])

    const container = await renderWithProviders(
      <SwitchableEditor notes={[first, second]} />,
    )

    await typeInto(titleInput(container), "First v2")
    await advance(800)
    await click(byLabelText("Open Second") as HTMLElement)

    await typeInto(titleInput(container), "Second v2")
    await advance(800)
    await click(byLabelText("Open First") as HTMLElement)

    expect(titleInput(container).value).toBe("First v2")
    await click(byLabelText("Open Second") as HTMLElement)
    expect(titleInput(container).value).toBe("Second v2")
  })
})

describe("save failures", () => {
  function failingStorage(): {
    restore: () => void
    heal: () => void
  } {
    const original = Storage.prototype.setItem
    let broken = true

    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (broken && key === NOTES_STORAGE_KEY) {
          throw new Error("Storage is unavailable")
        }

        original.call(this, key, value)
      })

    return {
      heal: () => {
        broken = false
      },
      restore: () => spy.mockRestore(),
    }
  }

  it("shows a failure state without losing the typed draft", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const storage = failingStorage()

    await openNote(note)
    await typeInto(titleInput(), "Never stored")
    await advance(800)

    expect(saveState()).toBe("error")
    expect(saveLabel()).toBe("Not saved")
    expect(titleInput().value).toBe("Never stored")
    expect(query(".editor-save-status .visually-hidden")?.textContent).toContain(
      "Storage is unavailable",
    )

    storage.restore()
  })

  it("shows the failure reason in visible text", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const storage = failingStorage()

    await openNote(note)
    await typeInto(titleInput(), "Never stored")
    await advance(800)

    const detail = query(".editor-save-status__detail")

    expect(detail?.textContent).toContain("Storage is unavailable")
    // It is readable text, not an extra live region.
    expect(detail?.getAttribute("aria-live")).toBeNull()

    storage.restore()
  })

  it("keeps the previously stored value after a failed save", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const storage = failingStorage()

    await openNote(note)
    await typeInto(titleInput(), "Never stored")
    await advance(800)

    storage.restore()

    expect(savedNote(note.id).title).toBe("Draft")
  })

  it("recovers on a later attempt after the failure clears", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const storage = failingStorage()

    await openNote(note)
    await typeInto(titleInput(), "Stored later")
    await advance(800)

    expect(saveState()).toBe("error")

    storage.heal()

    await typeInto(titleInput(), "Stored later!")
    await advance(800)

    expect(saveState()).toBe("saved")
    expect(savedNote(note.id).title).toBe("Stored later!")
  })

  it("recovers without further typing after a blur", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const storage = failingStorage()

    await openNote(note)
    await typeInto(titleInput(), "Recovered")
    await advance(800)

    expect(saveState()).toBe("error")

    storage.heal()

    await act(async () => {
      titleInput().focus()
      titleInput().blur()
    })

    await flush(10)

    expect(saveState()).toBe("saved")
    expect(savedNote(note.id).title).toBe("Recovered")
  })
})

describe("accessible editor structure", () => {
  it("labels the title and tag fields and names the note body", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    const labelledIds = new Set(
      queryAll<HTMLLabelElement>("label[for]", container).map(
        (label) => label.getAttribute("for"),
      ),
    )

    expect(labelledIds.has(titleInput(container).id)).toBe(true)
    expect(labelledIds.has(tagInput(container).id)).toBe(true)

    /*
     * The body is an editable region rather than a form control, so there is no input
     * element for a `label` to point at. It is named the other way instead, and the name
     * has to be there: an unnamed editable region announces itself as just "edit".
     */
    const body = proseElement(container)

    expect(body.getAttribute("role")).toBe("textbox")
    expect(body.getAttribute("aria-label")).toBe("Note content")
    expect(body.getAttribute("aria-multiline")).toBe("true")
    expect(body.getAttribute("contenteditable")).toBe("true")
  })

  it("keeps the body editable in edit mode and read-only in preview", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    expect(proseElement(container).getAttribute("contenteditable")).toBe("true")

    await click(modeTab("Preview", container))

    const body = proseElement(container)

    expect(body.getAttribute("contenteditable")).toBe("false")
    expect(body.getAttribute("aria-readonly")).toBe("true")
  })

  it("gives the read-only panel a tab stop so the keyboard can scroll it", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    expect(
      query('[role="tabpanel"]', container)?.getAttribute("tabindex"),
    ).toBeNull()

    await click(modeTab("Preview", container))

    expect(query('[role="tabpanel"]', container)?.getAttribute("tabindex")).toBe(
      "0",
    )
  })

  it("names the mode tablist and links tabs to panels", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    const list = query('[role="tablist"]', container)
    const tab = modeTab("Edit", container)
    const panel = query('[role="tabpanel"]', container)

    expect(list?.getAttribute("aria-label")).toBe("Note view mode")
    expect(tab.getAttribute("aria-controls")).toBe(panel?.id)
    expect(panel?.getAttribute("aria-labelledby")).toBe(tab.id)
  })

  it("announces save results politely", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)
    const live = query('[aria-live="polite"]', container)

    expect(live?.getAttribute("role")).toBe("status")

    await typeInto(titleInput(), "Announced")
    await advance(800)

    expect(live?.textContent).toBe("Saved.")
  })

  it("keeps the delete control available in the editor footer", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    expect(byLabelText("Delete note", container)).not.toBeNull()
  })
})

/**
 * Reading order is the hierarchy.
 *
 * The title, the tags, the mode switch, the content, then the state of the save and
 * the one destructive action. Delete used to sit above the title, which put the most
 * dangerous control in the first thing a finger lands on and made the save status
 * compete with the mode switch for one row.
 */
describe("editor hierarchy", () => {
  it("reads title, tags, modes, content, then status and delete", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    const editor = query(".editor", container)

    if (editor === null) {
      throw new Error("editor not rendered")
    }

    const order = Array.from(editor.children).map((child) =>
      child.className.toString(),
    )

    expect(order).toEqual([
      "visually-hidden", // the single h1
      "visually-hidden", // the title's own label
      "editor__title-input",
      "editor-tags",
      "editor__toolbar-row", // the mode switch, and the control that resizes the note
      "editor-toolbar", // the formatting row, above the writing surface
      "editor__panel", // the note body, in whichever mode owns it
      "editor__footer",
    ])
  })

  /*
   * The formatting row used to sit inside the panel, which meant the panel drew its
   * boundary around a row of controls as well as around the note. The row belongs
   * above the surface, where a reader can tell that the surface is a document rather
   * than a field that happens to contain controls.
   */
  it("keeps the formatting row outside the writing surface", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)
    const panel = query(".editor__panel", container)
    const toolbar = query(".editor-toolbar", container)

    expect(toolbar).not.toBeNull()
    expect(panel?.contains(toolbar as HTMLElement)).toBe(false)

    // It is still the row immediately above the surface, in both the visual and tab order.
    const editor = query(".editor", container)
    const order = Array.from(editor?.children ?? []).map((child) =>
      child.className.toString(),
    )

    expect(order.indexOf("editor-toolbar")).toBe(order.indexOf("editor__panel") - 1)
  })

  it("offers the formatting row in writing mode only", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    expect(query(".editor-toolbar", container)).not.toBeNull()

    await click(modeTab("Preview", container))

    expect(query(".editor-toolbar", container)).toBeNull()

    await click(modeTab("Edit", container))

    expect(query(".editor-toolbar", container)).not.toBeNull()
  })

  /*
   * The form is opened from the row that now owns it, and what it does is still to the
   * note: a control that moved has to keep acting on the same thing.
   */
  it("opens the link form from the row and applies it to the note", async () => {
    const note = makeNote({ title: "Draft", content: "a note to link" })
    await seedStorage([note])

    const container = await openNote(note)

    await selectFirstParagraph(container)
    await click(byLabelText("Link") as HTMLElement)

    const field = query<HTMLInputElement>(".link-menu__address", container)

    expect(field).not.toBeNull()

    await type(field as HTMLInputElement, "example.com")
    await click(byLabelText("Apply link", container) as HTMLElement)

    expect(editorMarkdown(container)).toContain("https://example.com")
  })

  /*
   * The expanded view is the same editor given the window, not a second copy of the
   * note. What holds that together is that nothing about the document is remounted to
   * open it: the same element is still there afterwards, with the same content and the
   * same caret.
   */
  describe("the expanded writing area", () => {
    async function openExpanded() {
      const note = makeNote({ title: "Draft", content: "a note worth more room" })
      await seedStorage([note])

      const container = await openNote(note)
      const control = byLabelText("Expand writing area", container)

      if (control === null) {
        throw new Error("expand control not rendered")
      }

      return { container, control, note }
    }

    it("is one control that says which way it goes", async () => {
      const { container, control } = await openExpanded()

      expect(control.getAttribute("aria-expanded")).toBe("false")

      await click(control)

      const close = byLabelText("Close expanded writing area", container)

      expect(close).not.toBeNull()
      expect(close?.getAttribute("aria-expanded")).toBe("true")
      // The same control, not a second one.
      expect(queryAll(".editor-expand", container)).toHaveLength(1)

      await click(close as HTMLElement)

      expect(byLabelText("Expand writing area", container)).not.toBeNull()
      expect(query(".editor", container)?.getAttribute("data-expanded")).toBe(null)
    })

    it("marks the editor itself as expanded so the CSS can give it the window", async () => {
      const { container, control } = await openExpanded()

      await click(control)

      expect(query(".editor", container)?.getAttribute("data-expanded")).toBe("true")
    })

    it("closes on Escape from inside the note", async () => {
      const { container, control } = await openExpanded()

      await click(control)
      await pressKey(proseElement(container), "Escape")

      expect(query(".editor", container)?.getAttribute("data-expanded")).toBe(null)
      expect(byLabelText("Expand writing area", container)).not.toBeNull()
    })

    it("puts the caret in the document on the way in and the focus on the control on the way out", async () => {
      const { container, control } = await openExpanded()

      await click(control)

      expect(document.activeElement).toBe(proseElement(container))

      await click(byLabelText("Close expanded writing area", container) as HTMLElement)

      expect(document.activeElement).toBe(control)
    })

    it("keeps the note the reader already had, rather than a second rendering of it", async () => {
      const { container, control } = await openExpanded()
      const before = proseElement(container)

      await typeInNote(" and the words that follow", container)
      await click(control)

      // The very same element, still holding the very same text and caret.
      expect(proseElement(container)).toBe(before)
      expect(editorMarkdown(container)).toContain("and the words that follow")

      await click(byLabelText("Close expanded writing area", container) as HTMLElement)

      expect(proseElement(container)).toBe(before)
      expect(editorMarkdown(container)).toContain("and the words that follow")
    })

    it("offers the same control in preview, where the note is read rather than written", async () => {
      const { container } = await openExpanded()

      await click(modeTab("Preview", container))

      const control = byLabelText("Expand writing area", container)

      expect(control).not.toBeNull()

      await click(control as HTMLElement)

      expect(query(".editor", container)?.getAttribute("data-expanded")).toBe("true")
    })
  })

  it("puts the save status and the delete control in the same footer", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    const footer = query(".editor__footer", container)

    expect(footer).not.toBeNull()
    expect(query(".editor-save-status", footer as ParentNode)).not.toBeNull()
    expect(byLabelText("Delete note", footer as ParentNode)).not.toBeNull()
  })

  it("takes the status out of the mode switch row", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    /*
     * On a narrow screen the mode switch and the status used to be pushed into each
     * other by the same flex row. The footer gives each its own space.
     */
    expect(query(".editor__toolbar-row .editor-save-status", container)).toBeNull()
  })

  it("reads the status first, the way out second, and the destructive action last", async () => {
    const note = makeNote({ title: "Draft" })
    await seedStorage([note])

    const container = await openNote(note)

    const footer = query(".editor__footer", container)

    /*
     * Export sits between the two on purpose: both are about the note, but only one
     * of them can lose it. The destructive action stays last in the visual order and
     * in the tab order.
     */
    expect(
      Array.from((footer as HTMLElement).children).map((child) =>
        child.className.toString(),
      ),
    ).toEqual(["editor-save-status", "export-menu", "editor-delete"])
  })
})

describe("deleting the edited note", () => {
  it("never writes a draft back to a note being deleted", async () => {
    const doomed = makeNote({ title: "Doomed" })
    const keeper = makeNote({ title: "Keeper" })
    await seedStorage([doomed, keeper])

    navigation.pathname.value = `/notes/${doomed.id}`

    await renderWithProviders(<NoteDetailView noteId={doomed.id} />)

    await typeInNote("text that must never be stored")
    await click(byLabelText("Delete note") as HTMLElement)

    const dialog = query("dialog.confirm-dialog")
    await click(byLabelText("Delete", dialog as ParentNode) as HTMLElement)
    await advance(1000)

    expect(storedNotes().map((note) => note.id)).toEqual([keeper.id])
  })

  it("keeps the untouched note intact when deleting its neighbour", async () => {
    const doomed = makeNote({ title: "Doomed" })
    const keeper = makeNote({ title: "Keeper" })
    await seedStorage([doomed, keeper])

    navigation.pathname.value = `/notes/${doomed.id}`

    await renderWithProviders(<NoteDetailView noteId={doomed.id} />)

    await click(byLabelText("Delete note") as HTMLElement)

    const dialog = query("dialog.confirm-dialog")
    await click(byLabelText("Delete", dialog as ParentNode) as HTMLElement)
    await advance(1000)

    expect(savedNote(keeper.id).title).toBe("Keeper")
  })
})