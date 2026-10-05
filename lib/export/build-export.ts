import type { Paragraph as DocxParagraph } from "docx"

import { exportFormat, type ExportFormatId } from "@/lib/export/export-formats"
import { exportFileName } from "@/lib/export/export-filename"
import {
  inlineToPlainText,
  parseMarkdownBlocks,
  toPlainText,
  type ExportBlock,
} from "@/lib/export/markdown-blocks"

export interface ExportableNote {
  title: string
  content: string
}

export interface BuiltExport {
  blob: Blob
  fileName: string
  mediaType: string
}

/**
 * Builds the file, not the download.
 *
 * Keeping these apart means the four formats can be tested as files: what comes out
 * is a Blob with the right media type and a name that a filesystem will accept, and
 * the browser's part, clicking a link it cannot click in a test, stays out of it.
 *
 * `jspdf` and `docx` are imported dynamically. They are the two heavy dependencies
 * in the app, and a note is read far more often than it is exported, so neither is
 * paid for until the moment someone asks for that file.
 */
export async function buildExport(
  id: ExportFormatId,
  note: ExportableNote,
): Promise<BuiltExport> {
  const format = exportFormat(id)
  const title = note.title.trim()

  const blob =
    id === "txt"
      ? new Blob([toPlainText(note.content)], { type: format.mediaType })
      : id === "md"
        ? new Blob([note.content], { type: format.mediaType })
        : id === "pdf"
          ? await buildPdf(note, title)
          : await buildDocx(note, title)

  return {
    blob,
    fileName: exportFileName(title, format.extension),
    mediaType: format.mediaType,
  }
}

function buildPdf(note: ExportableNote, title: string): Promise<Blob> {
  return import("jspdf").then(({ jsPDF }) => {
    const document = new jsPDF({ unit: "pt", format: "a4" })

    const pageWidth = document.internal.pageSize.getWidth()
    const pageHeight = document.internal.pageSize.getHeight()
    const margin = 56
    const textWidth = pageWidth - margin * 2
    const bottom = pageHeight - margin

    let y = margin
    let orderedCount = 0

    const writeLines = (
      lines: readonly string[],
      size: number,
      options: { bold?: boolean; italic?: boolean; mono?: boolean; indent?: number } = {},
    ) => {
      const indent = options.indent ?? 0
      document.setFont(
        options.mono === true ? "courier" : "helvetica",
        options.bold === true ? "bold" : options.italic === true ? "italic" : "normal",
      )
      document.setFontSize(size)

      for (const line of lines) {
        // A page break is taken before a line that would not fit, never after it.
        if (y > bottom) {
          document.addPage()
          y = margin
        }

        document.text(line, margin + indent, y)
        y += size * 1.4
      }
    }

    const headingSize = (level: number) => Math.max(12, 20 - (level - 1) * 2)

    if (title !== "") {
      writeLines(document.splitTextToSize(title, textWidth) as string[], 18, {
        bold: true,
      })
      y += 10
    }

    for (const block of parseMarkdownBlocks(note.content)) {
      writeBlock(block)
    }

    return document.output("blob")

    function writeBlock(block: ExportBlock): void {
      switch (block.kind) {
        case "heading": {
          writeLines(
            document.splitTextToSize(block.text, textWidth) as string[],
            headingSize(block.level),
            { bold: true },
          )
          y += 8
          break
        }

        case "paragraph": {
          writeLines(
            document.splitTextToSize(inlineToPlainText(block.text), textWidth) as string[],
            11,
          )
          y += 8
          break
        }

        case "listItem": {
          const marker = block.ordered ? `${(orderedCount += 1)}.` : "-"
          orderedCount = block.ordered ? orderedCount : 0

          writeLines(
            document.splitTextToSize(
              `${marker}  ${inlineToPlainText(block.text)}`,
              textWidth - 16,
            ) as string[],
            11,
            { indent: 14 },
          )
          break
        }

        case "quote": {
          writeLines(
            document.splitTextToSize(inlineToPlainText(block.text), textWidth - 16) as string[],
            11,
            { italic: true, indent: 14 },
          )
          y += 6
          break
        }

        case "code": {
          writeLines(
            document.splitTextToSize(block.text, textWidth - 16) as string[],
            10,
            { mono: true, indent: 14 },
          )
          y += 8
          break
        }

        case "rule": {
          if (y > bottom) {
            document.addPage()
            y = margin
          }

          document.setDrawColor(200)
          document.line(margin, y, pageWidth - margin, y)
          y += 16
          break
        }
      }
    }
  })
}

function buildDocx(note: ExportableNote, title: string): Promise<Blob> {
  return import("docx").then(
    async ({
      AlignmentType,
      Document,
      HeadingLevel,
      LevelFormat,
      Packer,
      Paragraph,
      TextRun,
    }) => {
      const headingFor = (level: number) =>
        HeadingLevel[
          `HEADING_${Math.min(level + 1, 6)}` as keyof typeof HeadingLevel
        ]

      const children: DocxParagraph[] = []

      if (title !== "") {
        children.push(
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
        )
      }

      for (const block of parseMarkdownBlocks(note.content)) {
        switch (block.kind) {
          case "heading":
            children.push(
              new Paragraph({ text: block.text, heading: headingFor(block.level) }),
            )
            break

          case "paragraph":
            children.push(
              new Paragraph({ children: [new TextRun(inlineToPlainText(block.text))] }),
            )
            break

          case "listItem":
            /*
             * Real Word numbering rather than "1." typed into the text, so the list
             * renumbers itself when a line is added or removed in Word.
             */
            children.push(
              block.ordered
                ? new Paragraph({
                    children: [new TextRun(inlineToPlainText(block.text))],
                    numbering: { reference: "export-order", level: 0 },
                  })
                : new Paragraph({
                    children: [new TextRun(inlineToPlainText(block.text))],
                    bullet: { level: 0 },
                  }),
            )
            break

          case "quote":
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: inlineToPlainText(block.text), italics: true }),
                ],
                indent: { left: 360 },
              }),
            )
            break

          case "code":
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: block.text, font: "Courier New" }),
                ],
                shading: { fill: "F2F2F2" },
              }),
            )
            break

          case "rule":
            children.push(
              new Paragraph({
                text: "",
                border: { bottom: { color: "CCCCCC", space: 1, style: "single" } },
              }),
            )
            break
        }
      }

      if (children.length === 0) {
        children.push(new Paragraph({ text: "" }))
      }

      const document = new Document({
        numbering: {
          config: [
            {
              reference: "export-order",
              levels: [
                {
                  level: 0,
                  format: LevelFormat.DECIMAL,
                  text: "%1.",
                  alignment: AlignmentType.START,
                },
              ],
            },
          ],
        },
        sections: [{ children }],
      })

      return Packer.toBlob(document)
    },
  )
}