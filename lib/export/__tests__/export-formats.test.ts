import { describe, expect, it } from "vitest"

import { FALLBACK_FILE_STEM, exportFileName } from "@/lib/export/export-filename"
import { EXPORT_FORMATS, exportFormat } from "@/lib/export/export-formats"

describe("export file names", () => {
  it("names the file after the note", () => {
    expect(exportFileName("Grocery list", "md")).toBe("Grocery list.md")
  })

  it("takes out the characters a file system cannot hold", () => {
    expect(exportFileName('Q1/Q2 "plan": <draft>?', "pdf")).toBe(
      "Q1 Q2 plan draft.pdf",
    )
  })

  it("refuses to let a title become a path", () => {
    expect(exportFileName("../../etc/passwd", "txt")).toBe("etc passwd.txt")
  })

  it("hides nothing behind a leading or trailing dot", () => {
    expect(exportFileName(".hidden", "md")).toBe("hidden.md")
    expect(exportFileName("trailing.", "md")).toBe("trailing.md")
  })

  it("names an untitled note rather than leaving nothing", () => {
    expect(exportFileName("", "txt")).toBe(`${FALLBACK_FILE_STEM}.txt`)
    expect(exportFileName("   ", "pdf")).toBe(`${FALLBACK_FILE_STEM}.pdf`)
    expect(exportFileName("///", "md")).toBe(`${FALLBACK_FILE_STEM}.md`)
  })

  it("steps around the names Windows keeps for itself", () => {
    expect(exportFileName("CON", "txt")).toBe(`${FALLBACK_FILE_STEM}.txt`)
    expect(exportFileName("com1", "txt")).toBe(`${FALLBACK_FILE_STEM}.txt`)
  })

  it("keeps a long title inside what a file system accepts", () => {
    const name = exportFileName("word ".repeat(80), "md")

    expect(name.length).toBeLessThanOrEqual(104)
    expect(name.endsWith(".md")).toBe(true)
  })
})

describe("export formats", () => {
  it("offers text and Markdown first, then the two that need a library", () => {
    expect(EXPORT_FORMATS.map((format) => format.id)).toEqual([
      "txt",
      "md",
      "pdf",
      "docx",
    ])
    expect(EXPORT_FORMATS.filter((format) => format.needsLibrary).map((f) => f.id)).toEqual([
      "pdf",
      "docx",
    ])
  })

  it("gives every format a label and an extension", () => {
    for (const format of EXPORT_FORMATS) {
      expect(format.label).not.toBe("")
      expect(format.extension).toMatch(/^[a-z0-9]+$/)
      expect(format.mediaType).not.toBe("")
    }
  })

  it("refuses a format it does not know", () => {
    // @ts-expect-error the format id is checked at compile time.
    expect(() => exportFormat("rtf")).toThrow()
  })
})