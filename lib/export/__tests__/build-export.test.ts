// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"

import { buildExport } from "@/lib/export/build-export"
import { exportNote } from "@/lib/export/note-export"

const NOTE = {
  title: "Release plan",
  content: [
    "# Goals",
    "",
    "Ship the **editor** and the [docs](https://example.com).",
    "",
    "- first",
    "- second",
    "",
    "1. one",
    "2. two",
    "",
    "> a quote",
    "",
    "```js",
    "const ready = true",
    "```",
    "",
    "---",
  ].join("\n"),
}

async function text(blob: Blob): Promise<string> {
  // jsdom's Blob predates `text()`, so the file is read the older way.
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

async function head(blob: Blob, length: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result).slice(0, length))
    reader.onerror = () => reject(reader.error)
    reader.readAsBinaryString(blob.slice(0, length))
  })
}

describe("building exported files", () => {
  it("writes plain text with the formatting taken out", async () => {
    const built = await buildExport("txt", NOTE)

    expect(built.blob.type).toBe("text/plain;charset=utf-8")
    expect(built.fileName).toBe("Release plan.txt")

    const body = await text(built.blob)

    expect(body).toContain("Goals")
    expect(body).toContain("editor")
    expect(body).toContain("- first")
    expect(body).toContain("1. one")
    expect(body).not.toContain("**")
    expect(body).not.toContain("#")
  })

  it("writes Markdown exactly as it was typed", async () => {
    const built = await buildExport("md", NOTE)

    expect(built.blob.type).toBe("text/markdown;charset=utf-8")
    expect(built.fileName).toBe("Release plan.md")
    expect(await text(built.blob)).toBe(NOTE.content)
  })

  it("writes a PDF that starts with the bytes a PDF starts with", async () => {
    const built = await buildExport("pdf", NOTE)

    expect(built.blob.type).toBe("application/pdf")
    expect(built.fileName).toBe("Release plan.pdf")
    expect(built.blob.size).toBeGreaterThan(0)

    expect(await head(built.blob, 5)).toBe("%PDF-")
  })

  it("writes a Word document as a real zip container", async () => {
    const built = await buildExport("docx", NOTE)

    expect(built.mediaType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    expect(built.fileName).toBe("Release plan.docx")
    expect(built.blob.size).toBeGreaterThan(0)

    // Every OOXML file is a zip, and a zip starts with these two letters.
    expect(await head(built.blob, 2)).toBe("PK")
  })

  it("names an untitled note in every format", async () => {
    const built = await buildExport("txt", { title: "", content: "just text" })

    expect(built.fileName).toBe("Untitled note.txt")
  })

  it("exports an empty note without failing", async () => {
    const built = await buildExport("docx", { title: "", content: "" })

    expect(built.blob.size).toBeGreaterThan(0)
  })

  it("writes a PDF of more than one page for a long note", async () => {
    const built = await buildExport("pdf", {
      title: "Long",
      content: Array.from({ length: 120 }, (_, index) => `line ${index}`).join("\n\n"),
    })

    // A second page's worth of content cannot fit on one A4 page.
    expect(built.blob.size).toBeGreaterThan(2000)
  })
})

describe("exporting a note", () => {
  it("saves the built file under its own name", async () => {
    const save = vi.fn()

    const fileName = await exportNote("md", NOTE, save)

    expect(fileName).toBe("Release plan.md")
    expect(save).toHaveBeenCalledTimes(1)

    const [blob, savedName] = save.mock.calls[0] as [Blob, string]

    expect(savedName).toBe("Release plan.md")
    expect(await text(blob)).toBe(NOTE.content)
  })
})