// @vitest-environment jsdom

import { act, useState } from "react"
import type { Editor } from "@tiptap/core"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { EditorToolbar } from "@/components/editor/editor-toolbar"
import { RichTextEditor } from "@/components/editor/rich-text-editor"

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
  render,
  selectFirstParagraph,
  type,
  typeInNote,
  unmountAll,
} from "@/components/notes/__tests__/test-render"

/**
 * The writing surface, on its own.
 *
 * These are the parts of the editor that are new rather than the parts that were
 * carried over: the formatting row, the link form, and the two promises the surface
 * makes about itself, that Markdown is what leaves it and that nothing about it needs
 * Markdown to be used.
 *
 * The harness stands in for the note editor around the surface, which is where the
 * formatting row and the link form live: the row is above the writing surface rather
 * than inside it, and the instance it acts on is the one the surface reports.
 *
 * Everything here drives the editor through its own commands rather than through the
 * keyboard, because jsdom cannot type into a `contenteditable` region. What a keystroke
 * does in a browser is the manual pass's job; what these tests hold down is the wiring,
 * the state the row reports, and the Markdown that comes out.
 */
function Harness({ markdown }: { markdown: string }) {
  const [isEditable, setEditable] = useState(true)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [isLinkMenuOpen, setLinkMenuOpen] = useState(false)

  return (
    <div>
      <button type="button" onClick={() => setEditable((open) => !open)}>
        Toggle writing
      </button>

      {isEditable && (
        <EditorToolbar editor={editor} onEditLink={() => setLinkMenuOpen(true)} />
      )}

      <RichTextEditor
        markdown={markdown}
        placeholder="Write your note..."
        editable={isEditable}
        onChange={() => undefined}
        onBlur={() => undefined}
        onEditorReady={setEditor}
        isLinkMenuOpen={isLinkMenuOpen}
        onLinkMenuOpenChange={setLinkMenuOpen}
      />
    </div>
  )
}

async function open(markdown: string): Promise<HTMLElement> {
  return render(<Harness markdown={markdown} />)
}

function control(label: string, root: ParentNode = document): HTMLButtonElement {
  const button = byLabelText(label, root)

  if (button === null) {
    throw new Error(`control not found: ${label}`)
  }

  return button as HTMLButtonElement
}

function isPressed(label: string, root: ParentNode = document): boolean {
  return control(label, root).getAttribute("aria-pressed") === "true"
}

async function pressInEditor(
  key: string,
  init: KeyboardEventInit = {},
): Promise<void> {
  const dom = editorFor().view.dom

  await act(async () => {
    dom.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }),
    )
  })

  await flush()
}

/** Puts the caret at an absolute position in the document. */
async function placeCaret(position: number): Promise<void> {
  const editor = editorFor()

  await act(async () => {
    editor.commands.setTextSelection(position)
  })

  await flush()
}

/** Puts the caret inside the nth block of the note. */
async function placeCaretInBlock(index: number): Promise<void> {
  const editor = editorFor()
  let start = 0

  for (let position = 0; position < index; position += 1) {
    start += editor.state.doc.child(position).nodeSize
  }

  await placeCaret(start + 1)
}

function linkField(root: ParentNode = document): HTMLInputElement {
  const field = query<HTMLInputElement>(".link-menu__address", root)

  if (field === null) {
    throw new Error("link form is not open")
  }

  return field
}

/**
 * Types an address into the open form and applies it to the note's selection.
 *
 * The form is submitted through its own submit event, which is what clicking Apply and
 * what pressing Enter in the field both come to. That is the path worth holding down:
 * the address the reader typed has to reach the document command and come back out as
 * Markdown.
 */
async function applyLink(address: string): Promise<void> {
  await type(linkField(), address)

  const form = query<HTMLFormElement>(".link-menu", document)

  if (form === null) {
    throw new Error("link form is not open")
  }

  await act(async () => {
    form.requestSubmit()
  })

  await flush()
}

beforeAll(() => {
  /*
   * jsdom has no layout, so a range there cannot say where it is on the page. ProseMirror
   * asks every time it scrolls the caret into view, which is every time the selection
   * moves. Here the honest answer is "nowhere", and a measurement that says so is one the
   * view can carry on from, where a missing method is an exception thrown from inside the
   * editor and reported as an unhandled error.
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

beforeEach(() => {
  document.body.innerHTML = ""
})

afterEach(async () => {
  await unmountAll()
})

describe("the formatting row", () => {
  it("says which format is already on where the caret is", async () => {
    await open("<p><strong>bold</strong></p>")

    await selectFirstParagraph()

    expect(isPressed("Bold")).toBe(true)
    expect(isPressed("Italic")).toBe(false)
  })

  it("reports nothing as pressed in plain text", async () => {
    await open("<p>plain</p>")

    await selectFirstParagraph()

    expect(isPressed("Bold")).toBe(false)
    expect(isPressed("Bulleted list")).toBe(false)
    expect(isPressed("Checklist")).toBe(false)
  })

  it("turns a format off again when it is already on", async () => {
    await open("<p>text</p>")

    await selectFirstParagraph()
    await click(control("Bold"))
    expect(editorMarkdown()).toBe("**text**")

    await selectFirstParagraph()
    await click(control("Bold"))

    expect(editorMarkdown()).toBe("text")
  })

  it.each([
    ["Heading", "## Heading"],
    ["Bulleted list", "- Heading"],
    ["Numbered list", "1. Heading"],
    ["Quote", "> Heading"],
  ])(
    "writes %s as the Markdown a reader would expect",
    async (label, expected) => {
      await open("<p>Heading</p>")

      await selectFirstParagraph()
      await click(control(label))

      expect(editorMarkdown()).toBe(expected)
    },
  )

  it("writes a checklist as tick boxes rather than as bullets", async () => {
    await open("<p>Heading</p>")

    await selectFirstParagraph()
    await click(control("Checklist"))

    expect(editorMarkdown()).toBe("- [ ] Heading")
    expect(isPressed("Checklist")).toBe(true)
  })

  it("offers undo only when there is something to undo", async () => {
    await open("<p>text</p>")

    expect(control("Undo").disabled).toBe(true)
    expect(control("Redo").disabled).toBe(true)

    await selectFirstParagraph()
    await click(control("Bold"))

    expect(control("Undo").disabled).toBe(false)

    await click(control("Undo"))

    expect(editorMarkdown()).toBe("text")
    expect(control("Undo").disabled).toBe(true)
  })

  it("names its shortcut to assistive technology", async () => {
    await open("<p>text</p>")

    expect(control("Bold").getAttribute("aria-keyshortcuts")).toBe("Mod+B")
    expect(control("Link").getAttribute("aria-keyshortcuts")).toBe("Mod+K")
    // A block with no keyboard equivalent does not claim one.
    expect(control("Quote").getAttribute("aria-keyshortcuts")).toBeNull()
  })

  it("is not offered at all while the note is read-only", async () => {
    await open("<p>text</p>")

    await click(byLabelText("Toggle writing") as HTMLElement)

    expect(query(".editor-toolbar", document)).toBeNull()
  })
})

describe("the link form", () => {
  it("opens from the toolbar with nothing in it when there is no link yet", async () => {
    await open("<p>text</p>")

    await click(control("Link"))

    expect(linkField().value).toBe("")
  })

  it("opens from inside the text with Mod-K", async () => {
    await open("<p>text</p>")

    await placeCaret(2)
    await pressInEditor("k", { ctrlKey: true })

    expect(query(".link-menu", document)).not.toBeNull()
  })

  it("starts from the address the selection already has", async () => {
    await open('<p><a href="https://example.com">text</a></p>')

    await placeCaret(2)
    await click(control("Link"))

    expect(linkField().value).toBe("https://example.com")
  })

  it("turns a bare host name into a link the reader can follow", async () => {
    await open("<p>text</p>")

    await selectFirstParagraph()
    await click(control("Link"))
    await applyLink("example.com/page")

    expect(editorMarkdown()).toBe("[text](https://example.com/page)")
  })

  it("leaves an address that already names a scheme alone", async () => {
    await open("<p>text</p>")

    await selectFirstParagraph()
    await click(control("Link"))
    await applyLink("mailto:reader@example.com")

    expect(editorMarkdown()).toBe("[text](mailto:reader@example.com)")
  })

  it("writes the address itself when there is no text to mark", async () => {
    await open("<p></p>")

    await placeCaret(1)
    await click(control("Link"))
    await applyLink("example.com")

    /*
     * An address with nothing to attach to becomes the link's own words, normalised the
     * same way. What is written in the note is what a reader would copy out of it, and a
     * bare `example.com` copied out of a browser's address bar would be a dead link.
     */
    expect(editorMarkdown()).toBe("[https://example.com](https://example.com)")
  })

  it("takes the link off again", async () => {
    await open('<p><a href="https://example.com">text</a></p>')

    await placeCaret(2)
    await click(control("Link"))
    await click(control("Remove link"))

    expect(editorMarkdown()).toBe("text")
    expect(query(".link-menu", document)).toBeNull()
  })

  it("says so when the address is not an address, and keeps the form open", async () => {
    await open("<p>text</p>")

    await selectFirstParagraph()
    await click(control("Link"))
    await type(linkField(), "   ")
    await click(control("Apply link"))

    expect(query(".link-menu", document)).not.toBeNull()
    expect(linkField().getAttribute("aria-invalid")).toBe("true")
    expect(editorMarkdown()).toBe("text")
  })

  it("closes on Escape without touching the note", async () => {
    await open("<p>text</p>")

    await selectFirstParagraph()
    await click(control("Link"))
    await type(linkField(), "example.com")

    await act(async () => {
      linkField().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      )
    })

    await flush()

    expect(query(".link-menu", document)).toBeNull()
    expect(editorMarkdown()).toBe("text")
  })

  it("starts from nothing the next time it opens after a cancel", async () => {
    await open("<p>text</p>")

    await selectFirstParagraph()
    await click(control("Link"))
    await type(linkField(), "half-written")
    await act(async () => {
      linkField().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      )
    })
    await flush()

    await click(control("Link"))

    expect(linkField().value).toBe("")
  })
})

describe("select all", () => {
  /** The document the select-all assertions are read against. */
  const NOTE = "<p>first</p><ul><li>alpha</li></ul><p>last</p>"

  function selection(): { from: number; to: number; size: number } {
    const { state } = editorFor()

    return { from: state.selection.from, to: state.selection.to, size: state.doc.content.size }
  }

  it("takes the whole note, not the page around it", async () => {
    await open(NOTE)

    await placeCaret(2)
    await pressInEditor("a", { ctrlKey: true })

    const after = selection()

    expect(after.from).toBe(0)
    expect(after.to).toBe(after.size)
  })

  it("takes the whole note from inside a list item as well", async () => {
    await open("<ul><li>alpha<ul><li>nested</li></ul></li><li>beta</li></ul>")

    await placeCaret(9)
    await pressInEditor("a", { metaKey: true })

    expect(selection().from).toBe(0)
    expect(selection().to).toBe(selection().size)
  })

  it("stops the browser's own selection before it can reach the page", async () => {
    await open(NOTE)

    await placeCaret(2)

    const dom = editorFor().view.dom
    const seen: KeyboardEvent[] = []

    dom.addEventListener(
      "keydown",
      (event) => seen.push(event),
      { once: true },
    )

    await pressInEditor("a", { ctrlKey: true })

    // Without this the browser answers for itself, and what it answers differs by
    // browser: the note's text, or the whole page on a note with little in it.
    expect(seen).toHaveLength(1)
    expect(seen[0].defaultPrevented).toBe(true)
  })

  it("leaves a plain 'a' alone", async () => {
    await open("<p>text</p>")

    await placeCaret(1)
    await pressInEditor("a")

    expect(selection().from).toBe(1)
    expect(selection().to).toBe(1)
  })

  it("leaves Shift-Arrow selection to the editor", async () => {
    await open(NOTE)

    await placeCaret(2)

    const dom = editorFor().view.dom
    const seen: KeyboardEvent[] = []

    dom.addEventListener("keydown", (event) => seen.push(event), { once: true })

    await pressInEditor("ArrowDown", { shiftKey: true })

    /*
     * What is held down here is that the shortcut is not claimed: extending a selection
     * is the editor's own, and only the modifier shortcuts above are answered here. How
     * far the selection then moves is the browser's doing, which jsdom has no layout to
     * do it with, so that part is the manual pass's job.
     */
    expect(seen[0].defaultPrevented).toBe(false)
    expect(selection().from).toBe(2)
    expect(selection().to).toBe(2)
  })
})

describe("the surface itself", () => {
  it("marks an empty note so the hint has something to sit on", async () => {
    await open("")

    /*
     * The hint is drawn as the empty paragraph's own content, so the class and the text
     * belong on that paragraph rather than on the editor around it.
     */
    const block = proseElement().firstElementChild as HTMLElement

    expect(block.tagName).toBe("P")
    expect(block.className).toContain("rich-text--empty")
    expect(block.getAttribute("data-placeholder")).toBe("Write your note...")
  })

  it("has nothing left to hint at once there are words", async () => {
    await open("")

    await typeInNote("Body")

    const block = proseElement().firstElementChild as HTMLElement

    expect(block.className).not.toContain("rich-text--empty")
    expect(block.hasAttribute("data-placeholder")).toBe(false)
  })

  it("follows the caret rather than hinting on every empty line", async () => {
    await open("<p>First</p><p></p><p>Third</p>")

    /*
     * The hint is for the line the caret is on. A note with an empty line in the middle
     * of it would otherwise be advertising emptiness in three places at once.
     */
    expect(
      queryAll(".rich-text__prose > p").map((block) => block.className),
    ).not.toContain("rich-text--empty")

    await placeCaretInBlock(1)

    const blocks = queryAll(".rich-text__prose > p")

    expect(blocks[1].className).toContain("rich-text--empty")
    expect(blocks[0].className).not.toContain("rich-text--empty")
    expect(blocks[2].className).not.toContain("rich-text--empty")
  })

  it("reports a change only when the note's Markdown has actually changed", async () => {
    const changes: string[] = []

    await render(
      <RichTextEditor
        markdown="Body"
        placeholder="Write your note..."
        editable
        onChange={(value) => changes.push(value)}
        onBlur={() => undefined}
      />,
    )

    // Built, then had editing turned off: the same words both times.
    expect(changes).toEqual([])

    await clearNote()

    expect(changes).toEqual([""])
  })

  it("keeps the document readable with the keyboard when writing is off", async () => {
    await open("<p>Body</p>")

    await click(byLabelText("Toggle writing") as HTMLElement)

    const body = proseElement()

    expect(body.getAttribute("contenteditable")).toBe("false")
    expect(body.getAttribute("aria-readonly")).toBe("true")
    expect(body.getAttribute("tabindex")).toBe("0")
  })

  it("draws a checklist with a box per item rather than a bullet", async () => {
    await open("- [ ] milk\n- [x] bread")

    const items = queryAll(".rich-text__prose li")

    expect(items).toHaveLength(2)
    expect(proseElement().querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
    expect(proseElement().querySelectorAll("ul[data-type='taskList']")).toHaveLength(1)
  })
})