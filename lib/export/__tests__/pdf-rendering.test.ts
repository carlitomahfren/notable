import { describe, expect, it } from "vitest"
import { jsPDF } from "jspdf"

import { renderPdfDocument } from "@/lib/export/build-export"

/**
 * The PDF is read back as the bytes the document hands over rather than through a
 * parser: with compression off, the words that were written and the markers that
 * were not are both directly visible.
 */
function render(content: string, title = "") {
  const document = new jsPDF({ unit: "pt", format: "a4", compress: false })

  renderPdfDocument(document, { title, content })

  return {
    text: document.output(),
    pages: document.getNumberOfPages(),
  }
}

describe("reading a note into a PDF", () => {
  it("writes the words without the markers around them", () => {
    const { text } = render(
      [
        "# THIS IS A **HEADING**",
        "",
        "Bold says **THIS IS BOLD** and italics say _this is italic_.",
        "",
        "The `code` stays itself and ~~struck~~ is crossed out.",
      ].join("\n"),
      "Release plan",
    )

    expect(text).toContain("THIS IS A HEADING")
    expect(text).toContain("THIS IS BOLD")
    expect(text).toContain("this is italic")
    expect(text).toContain("code")
    expect(text).toContain("struck")

    expect(text).not.toContain("**")
    expect(text).not.toContain("_")
    expect(text).not.toContain("`")
    expect(text).not.toContain("#")
    expect(text).not.toContain("~~")
  })

  it("draws emphasis in the face that names it", () => {
    const { text } = render(
      ["**bold words**", "", "*italic words*", "", "`monospace words`"].join(
        "\n",
      ),
    )

    expect(text).toContain("Helvetica-Bold")
    expect(text).toContain("Helvetica-Oblique")
    expect(text).toContain("Courier")
    expect(text).toContain("bold words")
    expect(text).toContain("italic words")
    expect(text).toContain("monospace words")
  })

  it("keeps a link's address beside its label and points at it", () => {
    const { text } = render(
      "Read [the docs](https://example.com) before shipping.",
    )

    expect(text).toContain("the docs")
    expect(text).toContain("https://example.com")
    expect(text).not.toContain("[the docs]")

    // The address becomes a link in the file, not just printed text.
    expect(text).toContain("/URI")
  })

  it("leaves the state of a checklist on the page", () => {
    const { text } = render("- [x] shipped\n- [ ] waiting")

    expect(text).toContain("[x] shipped")
    expect(text).toContain("[ ] waiting")
  })

  it("leaves a fenced block exactly as it was written", () => {
    const { text } = render("```\nconst a = _x_ and *y*\n```")

    expect(text).toContain("const a = _x_ and *y*")
    expect(text).not.toContain("#")
  })

  it("indents a quote so it reads as someone else's words", () => {
    const { text } = render("> quoted aloud")

    expect(text).toContain("quoted aloud")
    expect(text).toContain("Helvetica-Oblique")
  })

  it("starts a second page when the note will not fit on one", () => {
    const { pages } = render(
      Array.from({ length: 120 }, (_, index) => `line ${index}`).join("\n\n"),
    )

    expect(pages).toBeGreaterThan(1)
  })

  it("exports an empty note without failing", () => {
    const { pages, text } = render("", "Untitled note")

    expect(pages).toBe(1)
    expect(text.startsWith("%PDF-")).toBe(true)
  })
})
