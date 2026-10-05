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
  | { kind: "listItem"; text: string; ordered: boolean }
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

function stripTaskMarker(item: string): string {
  const match = TASK_MARKER.exec(item)

  return match === null ? item : (match[2] ?? "")
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
      blocks.push({
        kind: "listItem",
        text: stripTaskMarker((unordered?.[1] ?? ordered?.[1] ?? "").trim()),
        ordered: ordered !== null,
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
 * nothing at all.
 */
export function toPlainText(markdown: string): string {
  const out: string[] = []
  let orderedCount = 0

  for (const block of parseMarkdownBlocks(markdown)) {
    switch (block.kind) {
      case "heading":
        out.push(block.text)
        break

      case "paragraph":
        out.push(block.text)
        break

      case "listItem":
        if (block.ordered) {
          orderedCount += 1
          out.push(`${orderedCount}. ${block.text}`)
        } else {
          orderedCount = 0
          out.push(`- ${block.text}`)
        }
        break

      case "quote":
        out.push(block.text.split("\n").map((line) => `> ${line}`).join("\n"))
        break

      case "code":
        out.push(block.text)
        break

      case "rule":
        out.push("---")
        break
    }
  }

  return inlineToPlainText(out.join("\n\n"))
}

type InlineRule = readonly [
  RegExp,
  string | ((match: string, ...groups: string[]) => string),
]

const INLINE: readonly InlineRule[] = [
  // Images before links: `![alt](src)` contains the link pattern.
  [/!\[([^\]]*)\]\([^)]*\)/g, "$1"],
  [
    /\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g,
    (match: string, text: string, href: string) =>
      text === "" || text === href ? href : `${text} (${href})`,
  ],
  [/`{1,3}([^`]*)`{1,3}/g, "$1"],
  [/\*\*([^*]+)\*\*/g, "$1"],
  [/\*([^*]+)\*/g, "$1"],
  [/~~([^~]+)~~/g, "$1"],
  [/ {2,}\n/g, "\n"],
]

export function inlineToPlainText(text: string): string {
  return INLINE.reduce((result, [pattern, replacement]) => {
    return typeof replacement === "function"
      ? result.replace(pattern, replacement)
      : result.replace(pattern, replacement)
  }, text)
}