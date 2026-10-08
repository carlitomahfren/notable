/**
 * A deliberately small reading of Markdown, shared by every exported format.
 *
 * Export needs the same note understood four ways: as plain text, as Markdown, as a
 * PDF, and as a Word document. If each format parsed the source on its own they
 * would disagree about what a note contains, and a heading would come out bold in
 * one file and plain in another. So the source is read once, here, into blocks that
 * name what each piece is, and every format decides for itself how to draw them.
 *
 * This is not a CommonMark implementation and does not try to be. It recognises the
 * things a plain note is made of: headings, paragraphs, lists, quotes, fenced code,
 * and horizontal rules. Anything it does not recognise is kept as text rather than
 * dropped, because a note that loses a line on the way out is worse than one that
 * exports a table as a few plain lines.
 */
export type ExportBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "listItem"; text: string; ordered: boolean; checked?: boolean }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "rule" }

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const THEMATIC_BREAK = /^(?:-{3,}|\*{3,}|_{3,})\s*$/
const FENCE = /^(?:```|~~~)(.*)$/
const UNORDERED_ITEM = /^\s*[-*+]\s+(.*)$/
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/
const TASK_MARKER = /^\[([ xX])\]\s+(.*)$/
const QUOTED = /^\s*>\s?(.*)$/

/**
 * Two trailing spaces are Markdown's hard line break, and a trailing backslash is the
 * other spelling of the same thing. Both mean the author wanted two lines rather
 * than one, so both survive into the exported text.
 */
const HARD_BREAK = /\s{2,}$|\\$/

function joinLines(lines: readonly string[]): string {
  let text = ""

  for (const [index, line] of lines.entries()) {
    const content = line.replace(HARD_BREAK, "")

    if (index === 0) {
      text = content
      continue
    }

    /*
     * The break is written at the end of the line it ends, so the line before this
     * one decides whether this one starts a new line or continues the same one.
     */
    const previousEndsWithBreak = HARD_BREAK.test(lines[index - 1] ?? "")

    text += previousEndsWithBreak ? `\n${content}` : ` ${content}`
  }

  return text
}

export function parseMarkdownBlocks(markdown: string): ExportBlock[] {
  const blocks: ExportBlock[] = []
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")

  let paragraph: string[] = []

  const flushParagraph = () => {
    const text = joinLines(paragraph).trim()

    if (text !== "") {
      blocks.push({ kind: "paragraph", text })
    }

    paragraph = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""

    const fence = FENCE.exec(line)

    if (fence !== null) {
      flushParagraph()

      const code: string[] = []
      index += 1

      while (index < lines.length) {
        const candidate = lines[index] ?? ""

        if (FENCE.test(candidate)) {
          break
        }

        code.push(candidate)
        index += 1
      }

      blocks.push({ kind: "code", text: code.join("\n") })
      continue
    }

    if (line.trim() === "") {
      flushParagraph()
      continue
    }

    if (THEMATIC_BREAK.test(line)) {
      flushParagraph()
      blocks.push({ kind: "rule" })
      continue
    }

    const heading = HEADING.exec(line)

    if (heading !== null) {
      flushParagraph()
      blocks.push({
        kind: "heading",
        level: Math.min((heading[1] ?? "#").length, 6) as 1 | 2 | 3 | 4 | 5 | 6,
        text: (heading[2] ?? "").trim(),
      })
      continue
    }

    const unordered = UNORDERED_ITEM.exec(line)
    const ordered = ORDERED_ITEM.exec(line)

    if (unordered !== null || ordered !== null) {
      flushParagraph()

      const item = (unordered?.[1] ?? ordered?.[1] ?? "").trim()
      const task = TASK_MARKER.exec(item)

      blocks.push({
        kind: "listItem",
        text: (task === null ? item : (task[2] ?? "")).trim(),
        ordered: ordered !== null,
        // Only a task carries the word; an ordinary item has no state to report.
        ...(task === null ? {} : { checked: (task[1] ?? " ").toUpperCase() === "X" }),
      })
      continue
    }

    const quoted = QUOTED.exec(line)

    if (quoted !== null) {
      flushParagraph()

      const quotedLines: string[] = []

      while (index < lines.length) {
        const next = QUOTED.exec(lines[index] ?? "")

        if (next === null) {
          break
        }

        quotedLines.push(next[1] ?? "")
        index += 1
      }

      index -= 1

      blocks.push({ kind: "quote", text: joinLines(quotedLines).trim() })
      continue
    }

    paragraph.push(line)
  }

  flushParagraph()

  return blocks
}

/**
 * Inline markers are removed for the formats that have no formatting of their own.
 *
 * Only the markers are dropped: link text is kept and the address goes after it, so
 * a link survives as text rather than turning into the bare URL or, worse, into
 * nothing at all. Fenced code is the one block left exactly as written, because its
 * whole point is that the characters inside it are literal.
 */
export function toPlainText(markdown: string): string {
  const out: string[] = []
  let orderedCount = 0

  for (const block of parseMarkdownBlocks(markdown)) {
    switch (block.kind) {
      case "heading":
        out.push(inlineToPlainText(block.text))
        break

      case "paragraph":
        out.push(inlineToPlainText(block.text))
        break

      case "listItem": {
        const box =
          block.checked === undefined
            ? ""
            : block.checked
              ? "[x] "
              : "[ ] "

        if (block.ordered) {
          orderedCount += 1
          out.push(`${orderedCount}. ${box}${inlineToPlainText(block.text)}`)
        } else {
          orderedCount = 0
          out.push(`- ${box}${inlineToPlainText(block.text)}`)
        }
        break
      }

      case "quote":
        out.push(
          inlineToPlainText(block.text)
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n"),
        )
        break

      case "code":
        out.push(block.text)
        break

      case "rule":
        out.push("---")
        break
    }
  }

  return out.join("\n\n")
}

/**
 * One piece of inline text, with the formatting the author gave it.
 *
 * The pieces are flat rather than nested: a bold link is a link run that is also
 * bold, not a link inside a bold. Formats that can only do one thing at a time then
 * decide for themselves which flag they honour.
 */
export interface InlineRun {
  text: string
  bold?: boolean
  italic?: boolean
  strike?: boolean
  /** Literal text: nothing inside it is a marker. */
  code?: boolean
  /** The address of a link; present only on link runs. */
  href?: string
}

interface InlineStyle {
  bold?: boolean
  italic?: boolean
  strike?: boolean
}

const CODE_SPAN = /^`{1,3}([^`]*?)`{1,3}/
const IMAGE = /^!\[([^\]]*)\]\([^)]*\)/
const LINK = /^\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/
const ESCAPED_CHAR = /[\`*_~[\]!\\]/
const WORD_CHAR = /[\p{L}\p{N}_]/u

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && WORD_CHAR.test(character)
}

/**
 * Reads inline markers into runs, honouring backslash escapes.
 *
 * Emphasis with an underscore is only real at a word boundary, so `snake_case`
 * keeps its underscore while `_this one_` becomes italic. That is the one rule of
 * CommonMark this parser takes trouble over, because it is the rule that decides
 * whether a plain variable name comes out of an export mangled.
 */
function scanInline(text: string, style: InlineStyle, out: InlineRun[]): void {
  let plain = ""
  let index = 0

  const flush = () => {
    if (plain !== "") {
      out.push({ text: plain, ...style })
      plain = ""
    }
  }

  while (index < text.length) {
    const character = text[index] ?? ""

    if (character === "\\" && ESCAPED_CHAR.test(text[index + 1] ?? "")) {
      plain += text[index + 1]
      index += 2
      continue
    }

    if (character === "`") {
      const code = CODE_SPAN.exec(text.slice(index))

      if (code !== null) {
        flush()
        out.push({ text: code[1] ?? "", code: true, ...style })
        index += code[0].length
        continue
      }
    }

    if (character === "!" && text[index + 1] === "[") {
      const image = IMAGE.exec(text.slice(index))

      if (image !== null) {
        // An image has no page of its own in a text file, so only its words carry on.
        plain += inlineToPlainText(image[1] ?? "")
        index += image[0].length
        continue
      }
    }

    if (character === "[") {
      const link = LINK.exec(text.slice(index))

      if (link !== null) {
        flush()
        out.push({
          text: inlineToPlainText(link[1] ?? ""),
          href: link[2] ?? "",
          ...style,
        })
        index += link[0].length
        continue
      }
    }

    const marker =
      character === "*"
        ? text.startsWith("**", index)
          ? "**"
          : "*"
      : character === "_"
        ? text.startsWith("__", index)
          ? "__"
          : "_"
      : null

    if (marker !== null) {
      const from = index + marker.length
      const close = text.indexOf(marker, from)

      /*
       * An underscore opens emphasis only where a word has not already begun, and
       * closes only where one does not continue, so `snake_case` keeps its
       * underscores while `_these two_` becomes italic.
       */
      const opensAtBoundary = marker[0] !== "_" || !isWordCharacter(text[index - 1])
      const closesAtBoundary =
        close === -1 || !isWordCharacter(text[close + marker.length])

      if (close > from && opensAtBoundary && closesAtBoundary) {
        flush()

        // Two characters is strong, one is emphasis; either is kept from the
        // emphasis already in force around it.
        const nested: InlineStyle = { ...style }

        if (marker.length === 2) {
          nested.bold = true
        } else {
          nested.italic = true
        }

        scanInline(text.slice(from, close), nested, out)
        index = close + marker.length
        continue
      }
    }

    if (text.startsWith("~~", index)) {
      const close = text.indexOf("~~", index + 2)

      if (close > index + 2) {
        flush()
        scanInline(text.slice(index + 2, close), { ...style, strike: true }, out)
        index = close + 2
        continue
      }
    }

    plain += character
    index += 1
  }

  flush()
}

export function parseInlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = []

  scanInline(text, {}, runs)

  return runs
}

/**
 * What one run reads as in a format that cannot format: a link keeps its address
 * next to its label, and everything else is simply its own words.
 */
export function inlineRunText(run: InlineRun): string {
  if (run.href !== undefined) {
    return run.text === "" || run.text === run.href
      ? run.href
      : `${run.text} (${run.href})`
  }

  return run.text
}

export function inlineToPlainText(text: string): string {
  return parseInlineRuns(text).map(inlineRunText).join("")
}