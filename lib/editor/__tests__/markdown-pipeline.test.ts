// @vitest-environment jsdom

import { Editor } from "@tiptap/core"
import { afterEach, describe, expect, it } from "vitest"

import { noteEditorExtensions } from "@/lib/editor/extensions"
import { markdownToEditorHtml } from "@/lib/editor/parse-markdown"
import { editorDocumentToMarkdown } from "@/lib/editor/serialize-markdown"

/**
 * The seam between the stored note and the writing surface.
 *
 * The point of this file is that a note never has to be understood by a human being
 * in raw form. It is Markdown on disk and rich text on screen, and these tests are
 * where the two are proved to be the same note.
 */

const editors: Editor[] = []

/** The children of a document node, as plain objects the assertions can read. */
function nodes(node: unknown): Record<string, unknown>[] {
  const content = (node as { content?: unknown } | null)?.content

  return Array.isArray(content) ? (content as Record<string, unknown>[]) : []
}

/** The marks on every run of text in the first paragraph, as one string per run. */
function markNames(document: unknown): string[] {
  return nodes(nodes(document)[0]).map((node) =>
    ((node.marks ?? []) as { type?: string }[])
      .map((mark) => mark.type)
      .join("+"),
  )
}

function openNote(markdown: string): Editor {
  const editor = new Editor({
    extensions: noteEditorExtensions({ placeholder: "Writeâ€¦" }),
    content: markdownToEditorHtml(markdown),
  })

  editors.push(editor)

  return editor
}

function textOf(editor: Editor): string {
  return editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n")
}

function closeEditors(): void {
  while (editors.length > 0) {
    editors.pop()?.destroy()
  }
}

afterEach(closeEditors)

describe("reading a stored note into the editor", () => {
  it("reads a heading as a heading rather than as hash characters", () => {
    const editor = openNote("# Hello")

    expect(editor.getJSON().content?.[0]?.type).toBe("heading")
    expect(textOf(editor)).toBe("Hello")
  })

  it("reads bold and italic as formatting, not as visible markers", () => {
    const editor = openNote("This is **bold** and *italic*.")

    const marks = markNames(editor.getJSON())

    expect(marks).toEqual(["", "bold", "", "italic", ""])
    expect(textOf(editor)).toBe("This is bold and italic.")
  })

  it("reads strikethrough and inline code", () => {
    const editor = openNote("~~gone~~ and `code()`")

    expect(markNames(editor.getJSON())).toEqual(["strike", "", "code"])
  })

  it("reads underline, which Markdown spells as inline HTML", () => {
    const editor = openNote("<u>underlined</u>")

    expect(markNames(editor.getJSON())).toEqual(["underline"])
    expect(textOf(editor)).toBe("underlined")
  })

  it("reads a link as a link", () => {
    const editor = openNote("Read [the docs](https://example.com) first.")

    const link = nodes(nodes(editor.getJSON())[0]).find((node) =>
      ((node.marks ?? []) as { type?: string }[]).some(
        (mark) => mark.type === "link",
      ),
    )

    expect(link?.text).toBe("the docs")
    expect((link?.marks as { attrs?: { href?: string } }[])?.[0]?.attrs?.href).toBe(
      "https://example.com",
    )
  })

  it("reads bullet, numbered and task lists apart from each other", () => {
    const editor = openNote("- one\n- two\n\n1. first\n2. second\n\n- [ ] milk\n- [x] bread")

    const [bullets, numbers, tasks] = nodes(editor.getJSON())

    expect(bullets?.type).toBe("bulletList")
    expect(numbers?.type).toBe("orderedList")
    expect(tasks?.type).toBe("taskList")
    expect(
      nodes(tasks).map(
        (item) => (item.attrs as { checked?: boolean } | undefined)?.checked,
      ),
    ).toEqual([false, true])
  })

  it("never leaves a task marker in the text", () => {
    const editor = openNote("- [ ] milk\n- [x] bread")

    expect(textOf(editor)).toBe("milk\nbread")
  })

  it("reads a quote and a fenced code block", () => {
    const editor = openNote("> quoted\n\n```js\nconst x = 1\n```")

    const [quote, code] = nodes(editor.getJSON())

    expect(quote?.type).toBe("blockquote")
    expect(code?.type).toBe("codeBlock")
    expect((code?.attrs as { language?: string } | undefined)?.language).toBe("js")
    expect(textOf(editor)).toContain("const x = 1")
  })

  it("keeps an unknown construct as text rather than dropping the note's words", () => {
    const editor = openNote("| a | b |\n| - | - |\n| 1 | 2 |")

    expect(textOf(editor)).toContain("a")
    expect(textOf(editor)).toContain("2")
  })

  it("opens an empty note as one empty paragraph", () => {
    const editor = openNote("")

    expect(editor.isEmpty).toBe(true)
  })
})

/**
 * What the reader actually gets to see.
 *
 * The document and the page are two renderings of the same thing, and a schema can hold
 * a node perfectly well while the HTML that draws it is wrong: a heading whose tag was
 * changed for a page rule and quietly lost its words on the way is invisible in
 * `getJSON()` and obvious on screen. So these are assertions about `getHTML()`.
 */
describe("what the document draws", () => {
  it("draws every stored heading one level down, because the title owns h1", () => {
    const drawn = Array.from({ length: 6 }, (_, index) =>
      openNote(`${"#".repeat(index + 1)} Level`).getHTML(),
    )

    expect(drawn).toEqual([
      "<h2>Level</h2>",
      "<h3>Level</h3>",
      "<h4>Level</h4>",
      "<h5>Level</h5>",
      "<h6>Level</h6>",
      "<h6>Level</h6>",
    ])

    // Two different sizes for two different levels, which is the whole point.
    expect(new Set(drawn).size).toBe(5)
  })

  it("still writes the level it stored", () => {
    expect(editorDocumentToMarkdown(openNote("### Deeper").getJSON())).toBe(
      "### Deeper",
    )
  })

  it("writes the note as the page would have read it", () => {
    const html = openNote("A **bold** note with a [link](https://example.com).").getHTML()

    expect(html).toContain("<strong>bold</strong>")
    expect(html).toContain('href="https://example.com"')
  })

  it("draws a checklist with a box per item and no bullets", () => {
    const html = openNote("- [ ] milk\n- [x] bread").getHTML()

    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('type="checkbox"')
    expect(html).not.toContain("<li>")
  })

  it("keeps every word of a note the schema has no block for", () => {
    const html = openNote("| a | b |\n| - | - |\n| 1 | 2 |").getHTML()

    expect(html).toContain("a")
    expect(html).toContain("2")
  })

  it("draws the same document after editing is switched off", () => {
    const editor = openNote("# Heading\n\nBody.")

    editor.setEditable(false)

    // The preview is this document, so it has to survive being made read-only.
    expect(editor.getHTML()).toBe("<h2>Heading</h2><p>Body.</p>")
  })
})

describe("writing the editor's note back to storage", () => {
  it("writes each kind of block as the Markdown it came from", () => {
    const markdown = [
      "## Heading",
      "",
      "A paragraph with **bold**, _italic_, ~~struck~~ and `code`.",
      "",
      "- one",
      "- two",
      "",
      "1. first",
      "2. second",
      "",
      "- [ ] milk",
      "- [x] bread",
      "",
      "> quoted",
      "",
      "```js",
      "const x = 1",
      "```",
    ].join("\n")

    const output = editorDocumentToMarkdown(openNote(markdown).getJSON())

    expect(output).toBe(markdown)
  })

  it("writes a link as Markdown and keeps its address", () => {
    const output = editorDocumentToMarkdown(
      openNote("Read [the docs](https://example.com) first.").getJSON(),
    )

    expect(output).toBe("Read [the docs](https://example.com) first.")
  })

  it("writes underline as the inline HTML Markdown has to use for it", () => {
    const output = editorDocumentToMarkdown(openNote("<u>underlined</u>").getJSON())

    expect(output).toBe("<u>underlined</u>")
  })

  it("escapes a character that would otherwise come back as formatting", () => {
    const editor = openNote("2 * 3 * 4")
    editor.commands.setContent("<p>2 * 3 * 4</p>")

    const output = editorDocumentToMarkdown(editor.getJSON())

    // Stored escaped, and read back as the same three numbers.
    expect(output).toBe("2 \\* 3 \\* 4")
    expect(textOf(openNote(output))).toBe("2 * 3 * 4")
  })

  it("leaves an identifier alone, because Markdown does not read it as emphasis", () => {
    const output = editorDocumentToMarkdown(
      openNote("call some_variable_name here").getJSON(),
    )

    expect(output).toBe("call some_variable_name here")
  })

  it("writes an emptied note as an empty string", () => {
    const editor = openNote("something")
    editor.commands.clearContent()

    expect(editorDocumentToMarkdown(editor.getJSON())).toBe("")
  })

  it("writes a hard break as the two spaces that mean one", () => {
    const editor = openNote("line one\nline two")
    editor.commands.setContent("<p>line one<br>line two</p>")

    expect(editorDocumentToMarkdown(editor.getJSON())).toBe("line one  \nline two")
  })
})

/**
 * The property that actually matters: a note that has been opened and saved has not
 * changed. Compared as documents rather than as strings, because the Markdown may be
 * spelled differently and still mean the same thing.
 */
describe("a note survives the trip through the editor", () => {
  const notes: readonly [string, string][] = [
    ["paragraphs", "First paragraph.\n\nSecond paragraph."],
    ["a heading", "### A heading"],
    ["bold", "This is **bold**."],
    ["italic", "This is *italic*."],
    ["bold and italic together", "This is ***both***."],
    ["a link", "See [the manual](https://example.com/manual)."],
    ["a bullet list", "- one\n- two\n- three"],
    ["a numbered list", "1. one\n2. two\n3. three"],
    ["a checklist", "- [ ] one\n- [x] two"],
    ["a quote", "> quoted text"],
    ["inline code", "Run `npm test` first."],
    ["a code block", "```ts\nconst x: number = 1\n```"],
    ["mixed formatting", "A **bold** [link](https://example.com) and `code`."],
  ]

  for (const [name, markdown] of notes) {
    it(`keeps ${name} through two full round trips`, () => {
      const first = openNote(markdown)
      const once = editorDocumentToMarkdown(first.getJSON())
      const second = openNote(once)
      const twice = editorDocumentToMarkdown(second.getJSON())

      expect(second.getJSON()).toEqual(first.getJSON())
      expect(twice).toBe(once)
    })
  }

  it("keeps a note written entirely in the editor", () => {
    const editor = openNote("")
    editor.commands.setContent(
      "<h2>Plan</h2><p>Ship <strong>it</strong> with <em>care</em>.</p>",
    )

    const markdown = editorDocumentToMarkdown(editor.getJSON())
    const reopened = openNote(markdown)

    expect(reopened.getJSON()).toEqual(editor.getJSON())
    expect(markdown).toContain("**it**")
  })
})