import { describe, expect, it } from "vitest"

import { makeNote, resetNoteIds } from "./note-factory"

import { getNoteExcerpt, toPlainText } from "@/lib/notes/selectors"

function excerptOf(content: string, maxLength?: number): string {
  resetNoteIds()

  return getNoteExcerpt(makeNote({ content }), maxLength)
}

describe("toPlainText", () => {
  it("returns an empty string for empty content", () => {
    expect(toPlainText("")).toBe("")
  })

  it("collapses newlines and repeated whitespace into single spaces", () => {
    expect(toPlainText("one\n\ntwo   three")).toBe("one two three")
  })

  it("normalizes CRLF line endings", () => {
    expect(toPlainText("one\r\ntwo")).toBe("one two")
  })

  it("removes ATX heading markers", () => {
    expect(toPlainText("## Heading")).toBe("Heading")
    expect(toPlainText("###### Deep")).toBe("Deep")
  })

  it("removes blockquote markers", () => {
    expect(toPlainText("> quoted line")).toBe("quoted line")
  })

  it("removes unordered and ordered list markers", () => {
    expect(toPlainText("- one\n- two")).toBe("one two")
    expect(toPlainText("1. first\n2. second")).toBe("first second")
    expect(toPlainText("* star\n+ plus")).toBe("star plus")
  })

  it("keeps inline code content but drops backticks", () => {
    expect(toPlainText("use `npm run dev` here")).toBe("use npm run dev here")
  })

  it("drops fenced code blocks entirely", () => {
    expect(toPlainText("before\n```js\nconst a = 1\n```\nafter")).toBe(
      "before after",
    )
  })

  it("reduces links to their label", () => {
    expect(toPlainText("see [the docs](https://example.com) now")).toBe(
      "see the docs now",
    )
  })

  it("drops emphasis markers", () => {
    expect(toPlainText("**bold** and _italic_ and ~~struck~~")).toBe(
      "bold and italic and struck",
    )
  })

  it("flattens table rows", () => {
    expect(toPlainText("| a | b |")).toBe("a b")
  })

  it("removes thematic breaks", () => {
    expect(toPlainText("above\n---\nbelow")).toBe("above below")
  })
})

describe("getNoteExcerpt", () => {
  it("returns the plain content when it fits", () => {
    expect(excerptOf("short body")).toBe("short body")
  })

  it("returns an empty string when there is no content", () => {
    expect(excerptOf("")).toBe("")
  })

  it("truncates long content and appends an ellipsis", () => {
    const excerpt = excerptOf("word ".repeat(100))

    expect(excerpt.endsWith("…")).toBe(true)
    expect(excerpt.length).toBeLessThanOrEqual(141)
  })

  it("truncates on a word boundary rather than mid-word", () => {
    const excerpt = excerptOf("alpha beta gamma delta epsilon", 12)

    expect(excerpt).toBe("alpha beta…")
  })

  it("does not add an ellipsis when the text fits exactly", () => {
    expect(excerptOf("1234567890", 10)).toBe("1234567890")
  })

  it("honours a custom maximum length", () => {
    expect(excerptOf("one two three four", 7)).toBe("one two…")
  })

  it("returns an empty string for a non-positive maximum length", () => {
    expect(excerptOf("content", 0)).toBe("")
    expect(excerptOf("content", -5)).toBe("")
  })

  it("derives the excerpt from content without a title", () => {
    resetNoteIds()

    expect(
      getNoteExcerpt(
        makeNote({ title: "A title that is ignored", content: "body text" }),
      ),
    ).toBe("body text")
  })
})