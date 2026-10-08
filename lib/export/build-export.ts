import type { jsPDF } from "jspdf"
import type { Paragraph as DocxParagraph } from "docx"

import { exportFormat, type ExportFormatId } from "@/lib/export/export-formats"
import { exportFileName } from "@/lib/export/export-filename"
import {
  inlineRunText,
  inlineToPlainText,
  parseInlineRuns,
  parseMarkdownBlocks,
  toPlainText,
  type ExportBlock,
  type InlineRun,
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
          ? await buildPdf(note)
          : await buildDocx(note, title)

  return {
    blob,
    fileName: exportFileName(title, format.extension),
    mediaType: format.mediaType,
  }
}

function buildPdf(note: ExportableNote): Promise<Blob> {
  return import("jspdf").then(({ jsPDF }) => {
    const document = new jsPDF({ unit: "pt", format: "a4" })

    renderPdfDocument(document, note)

    return document.output("blob")
  })
}

interface RunStyle {
  indent?: number
  bold?: boolean
  italic?: boolean
}

type WordKind = "word" | "space" | "break"

interface Word {
  text: string
  run: InlineRun
  kind: WordKind
}

/**
 * The face a run is drawn in: the family and style jsPDF names them by, so a
 * reader, and the code below, agree on which words sit in the same face.
 */
function faceOf(
  run: InlineRun,
  base: RunStyle = {},
): [family: string, style: string] {
  const bold = run.bold === true || base.bold === true
  const italic = run.italic === true || base.italic === true

  if (run.code === true) {
    return ["courier", "normal"]
  }

  if (bold && italic) {
    return ["helvetica", "bolditalic"]
  }

  if (bold) {
    return ["helvetica", "bold"]
  }

  if (italic) {
    return ["helvetica", "italic"]
  }

  return ["helvetica", "normal"]
}

/**
 * Turns runs into the pieces a typesetter works with: whole words, the spaces
 * between them, and the breaks a hard newline asked for.
 */
function wordsOf(runs: readonly InlineRun[]): Word[] {
  const words: Word[] = []

  for (const run of runs) {
    // A link reads as its label plus its address, exactly as it does in text.
    const lines = inlineRunText(run).split("\n")

    for (const [index, line] of lines.entries()) {
      if (index > 0) {
        words.push({ text: "", run, kind: "break" })
      }

      for (const piece of line.split(/([ \t]+)/)) {
        if (piece === "") {
          continue
        }

        words.push({
          text: piece,
          run,
          kind: /^[ \t]+$/.test(piece) ? "space" : "word",
        })
      }
    }
  }

  return words
}

/** A word too long for the column is cut at the last character that still fits. */
function splitToFit(
  word: Word,
  maxWidth: number,
  measure: (word: Word) => number,
): Word[] {
  const pieces: Word[] = []
  let current = ""

  for (const character of Array.from(word.text)) {
    const candidate = current + character

    if (current !== "" && measure({ ...word, text: candidate }) > maxWidth) {
      pieces.push({ ...word, text: current })
      current = character
    } else {
      current = candidate
    }
  }

  if (current !== "") {
    pieces.push({ ...word, text: current })
  }

  return pieces.length > 0 ? pieces : [word]
}

/**
 * Fills lines to the width the column allows, breaking between words and only
 * between words, so a paragraph in a PDF reads like a paragraph rather than like
 * a note that has been sliced by character count.
 */
function wrapWords(
  words: readonly Word[],
  maxWidth: number,
  measure: (word: Word) => number,
): Word[][] {
  const lines: Word[][] = []
  let line: Word[] = []
  let lineWidth = 0

  const flush = () => {
    if (line.length > 0) {
      lines.push(line)
    }

    line = []
    lineWidth = 0
  }

  const startWith = (word: Word) => {
    line = [word]
    lineWidth = measure(word)
  }

  for (const word of words) {
    if (word.kind === "break") {
      flush()
      continue
    }

    if (line.length === 0) {
      // A line never begins with the space that was left over from the last wrap.
      if (word.kind === "space") {
        continue
      }

      const width = measure(word)

      if (width <= maxWidth) {
        startWith(word)
        continue
      }

      for (const piece of splitToFit(word, maxWidth, measure)) {
        startWith(piece)
        flush()
      }

      continue
    }

    const width = measure(word)

    if (lineWidth + width <= maxWidth) {
      line.push(word)
      lineWidth += width
      continue
    }

    flush()

    if (word.kind === "space") {
      continue
    }

    if (width <= maxWidth) {
      startWith(word)
      continue
    }

    for (const piece of splitToFit(word, maxWidth, measure)) {
      startWith(piece)
      flush()
    }
  }

  flush()

  return lines
}

/**
 * Draws a note onto a PDF document.
 *
 * The note is read into blocks first, and each block's words into runs, so the page
 * is typeset rather than printed as Markdown: bold is drawn in a bold face, code in a
 * monospace one, struck text with a line through it, and a link keeps its address
 * beside its label so the paper copy still says where it pointed.
 *
 * The document is an argument rather than something this creates, so a test can write
 * into a PDF it controls and read the result back out of it.
 */
export function renderPdfDocument(document: jsPDF, note: ExportableNote): void {
  const title = note.title.trim()
  const pageWidth = document.internal.pageSize.getWidth()
  const pageHeight = document.internal.pageSize.getHeight()
  const margin = 56
  const textWidth = pageWidth - margin * 2
  const bottom = pageHeight - margin

  let y = margin
  let orderedCount = 0

  const headingSize = (level: number) => Math.max(12, 20 - (level - 1) * 2)

  const newPageWhenFull = () => {
    if (y > bottom) {
      document.addPage()
      y = margin
    }
  }

  const setFont = (run: InlineRun, size: number, base: RunStyle = {}) => {
    const [family, style] = faceOf(run, base)

    document.setFont(family, style)
    document.setFontSize(size)
  }

  const writePlainLines = (
    text: string,
    size: number,
    options: RunStyle & { mono?: boolean } = {},
  ) => {
    const indent = options.indent ?? 0

    document.setFont(
      options.mono === true ? "courier" : "helvetica",
      options.mono === true ? "normal" : options.bold === true ? "bold" : "normal",
    )
    document.setFontSize(size)

    for (const line of document.splitTextToSize(text, textWidth - indent) as string[]) {
      newPageWhenFull()
      document.text(line, margin + indent, y)
      y += size * 1.4
    }
  }

  const writeRuns = (
    runs: readonly InlineRun[],
    size: number,
    options: RunStyle = {},
  ) => {
    const indent = options.indent ?? 0
    const words = wordsOf(runs)

    if (words.length === 0) {
      return
    }

    const measure = (word: Word) => {
      setFont(word.run, size, options)
      return document.getTextWidth(word.text)
    }

    /*
     * Two words may be written as one string only when they share everything the
     * writer will apply to them: the face they are set in, a line struck through
     * them, and where a link points.
     */
    const faceKey = (run: InlineRun) =>
      [...faceOf(run, options), run.strike === true, run.href ?? ""].join("|")

    for (const line of wrapWords(words, textWidth - indent, measure)) {
      newPageWhenFull()

      let x = margin + indent
      let groupText = ""
      let groupRun: InlineRun | null = null

      /*
       * Words in the same face are written as one string rather than one call
       * each: the gap between them then comes from the font itself, and copying a
       * sentence out of the file yields that sentence.
       */
      const writeGroup = () => {
        if (groupRun === null) {
          return
        }

        setFont(groupRun, size, options)

        const width = document.getTextWidth(groupText)

        if (groupText.trim() !== "") {
          if (groupRun.href !== undefined) {
            document.textWithLink(groupText, x, y, { url: groupRun.href })
          } else {
            document.text(groupText, x, y)
          }

          if (groupRun.strike === true) {
            document.setDrawColor(0)
            document.line(x, y - size * 0.3, x + width, y - size * 0.3)
          }
        }

        x += width
        groupText = ""
        groupRun = null
      }

      for (const word of line) {
        if (groupRun !== null && faceKey(word.run) !== faceKey(groupRun)) {
          writeGroup()
        }

        groupRun = word.run
        groupText += word.text
      }

      writeGroup()

      y += size * 1.4
    }
  }

  if (title !== "") {
    writePlainLines(title, 18, { bold: true })
    y += 10
  }

  for (const block of parseMarkdownBlocks(note.content)) {
    writeBlock(block)
  }

  function writeBlock(block: ExportBlock): void {
    switch (block.kind) {
      case "heading": {
        writeRuns(parseInlineRuns(block.text), headingSize(block.level), {
          bold: true,
        })
        y += 8
        break
      }

      case "paragraph": {
        writeRuns(parseInlineRuns(block.text), 11)
        y += 8
        break
      }

      case "listItem": {
        const marker = block.ordered
          ? `${(orderedCount += 1)}.`
          : block.checked === undefined
            ? "-"
            : block.checked
              ? "[x]"
              : "[ ]"
        orderedCount = block.ordered ? orderedCount : 0

        writeRuns(
          [{ text: `${marker} ` }, ...parseInlineRuns(block.text)],
          11,
          { indent: 14 },
        )
        break
      }

      case "quote": {
        writeRuns(parseInlineRuns(block.text), 11, { italic: true, indent: 14 })
        y += 6
        break
      }

      case "code": {
        writePlainLines(block.text, 10, { mono: true, indent: 14 })
        y += 8
        break
      }

      case "rule": {
        newPageWhenFull()
        document.setDrawColor(200)
        document.line(margin, y, pageWidth - margin, y)
        y += 16
        break
      }
    }
  }
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