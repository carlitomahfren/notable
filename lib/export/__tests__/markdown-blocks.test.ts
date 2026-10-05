import { describe, expect, it } from "vitest"

import {
  inlineToPlainText,
  parseMarkdownBlocks,
  toPlainText,
} from "@/lib/export/markdown-blocks"

describe("reading Markdown into blocks", () => {
  it("names each kind of line in a note", () => {
    const blocks = parseMarkdownBlocks(
      [
        "# Title",
        "",
        "A paragraph.",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "2. second",
        "",
        "> quoted",
        "",
        "```ts",
        "const answer = 42",
        "```",
        "",
        "---",
      ].join("\n"),
    )

    expect(blocks.map((block) => block.kind)).toEqual([
      "heading",
      "paragraph",
      "listItem",
      "listItem",
      "listItem",
      "listItem",
      "quote",
      "code",
      "rule",
    ])

    expect(blocks[0]).toEqual({ kind: "heading", level: 1, text: "Title" })
    expect(blocks[2]).toEqual({ kind: "listItem", text: "one", ordered: false })
    expect(blocks[4]).toEqual({ kind: "listItem", text: "first", ordered: true })
    expect(blocks[7]).toEqual({ kind: "code", text: "const answer = 42" })
  })

  it("keeps an unfinished fence as code rather than losing the rest", () => {
    const blocks = parseMarkdownBlocks("```\nunfinished")

    expect(blocks).toEqual([{ kind: "code", text: "unfinished" }])
  })

  it("drops the syntax of a checked task but keeps the words", () => {
    const blocks = parseMarkdownBlocks("- [x] shipped\n- [ ] not yet")

    expect(blocks.map((block) => (block.kind === "listItem" ? block.text : ""))).toEqual([
      "shipped",
      "not yet",
    ])
  })

  it("folds a soft-wrapped paragraph into one block", () => {
    const blocks = parseMarkdownBlocks("one line\ncontinued here")

    expect(blocks).toEqual([{ kind: "paragraph", text: "one line continued here" }])
  })

  it("keeps a hard line break as two lines", () => {
    const blocks = parseMarkdownBlocks("first  \nsecond")

    expect(blocks).toEqual([{ kind: "paragraph", text: "first\nsecond" }])
  })

  it("gathers a run of quoted lines into one block", () => {
    const blocks = parseMarkdownBlocks("> one\n> two\n\nafter")

    expect(blocks).toEqual([
      { kind: "quote", text: "one two" },
      { kind: "paragraph", text: "after" },
    ])
  })

  it("treats anything it cannot read as text instead of dropping it", () => {
    const blocks = parseMarkdownBlocks("| a | b |\n| - | - |\n| 1 | 2 |")

    expect(blocks.every((block) => block.kind === "paragraph")).toBe(true)
    expect(toPlainText("| a | b |\n| - | - |\n| 1 | 2 |")).toContain("| a | b |")
  })

  it("reads a note with nothing in it as no blocks", () => {
    expect(parseMarkdownBlocks("")).toEqual([])
    expect(parseMarkdownBlocks("   \n\n  ")).toEqual([])
  })

  it("reads a run of hashes that is not a heading as the text it is", () => {
    // Markdown agrees: seven hashes followed by text is not a heading.
    expect(parseMarkdownBlocks("####### too deep")).toEqual([
      { kind: "paragraph", text: "####### too deep" },
    ])
  })

  it("reads the deepest heading there is", () => {
    expect(parseMarkdownBlocks("###### deep")).toEqual([
      { kind: "heading", level: 6, text: "deep" },
    ])
  })
})

describe("writing text for formats that cannot format", () => {
  it("takes the markers out of a line", () => {
    expect(inlineToPlainText("**bold** and *italic* and `code`")).toBe(
      "bold and italic and code",
    )
  })

  it("keeps a link readable as text plus its address", () => {
    expect(inlineToPlainText("See [the docs](https://example.com).")).toBe(
      "See the docs (https://example.com).",
    )
  })

  it("leaves a bare address alone", () => {
    expect(inlineToPlainText("[https://example.com](https://example.com)")).toBe(
      "https://example.com",
    )
  })

  it("keeps a link's label when the image syntax is stripped", () => {
    expect(inlineToPlainText("![a diagram](diagram.png)")).toBe("a diagram")
  })

  it("numbers an ordered list and dashes an unordered one", () => {
    expect(toPlainText("- milk\n- eggs")).toBe("- milk\n\n- eggs")
    expect(toPlainText("1. milk\n2. eggs")).toBe("1. milk\n\n2. eggs")
  })

  it("keeps a quote readable as a quote", () => {
    expect(toPlainText("> a line\n> and another")).toBe("> a line and another")
  })
})