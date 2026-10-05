import type { JSONContent } from "@tiptap/core"
import { renderToMarkdown } from "@tiptap/static-renderer/pm/markdown"

import { noteEditorExtensions } from "@/lib/editor/extensions"

/**
 * The document the editor holds, written back as Markdown.
 *
 * This is the only path from rich text to storage, and it is why the note model needs
 * no second field: the formatting is expressed in the Markdown exactly as it always
 * was, and the editor's document is a projection of it rather than a second copy that
 * would have to be kept in step.
 *
 * The renderer is Tiptap's own local Markdown renderer, so every node and mark the
 * editor can produce is written the way that extension says it should be. Four things
 * need a decision from this app, and all four are given here rather than left to
 * chance:
 *
 * - A checklist. Its nodes are a `taskList` of `taskItem`s and GitHub's spelling is
 *   `- [ ]` on each line, which cannot be inferred from the node names. Left alone
 *   they would serialize as plain bullets and every tick would be gone by the next
 *   reload.
 * - A hard break, which is two spaces at the end of a Markdown line. The renderer's
 *   bare newline would fold two lines into one on the way back in.
 * - A fenced code block with no language, which must not serialize as ```null.
 * - Plain text, which is escaped. `2 * 3 * 4` typed in a note is arithmetic, and the
 *   Markdown it is stored as would otherwise read it back as emphasis. Escaping is
 *   what makes "type it, save it, reload it, it still says that" true.
 */
const extensions = noteEditorExtensions({ placeholder: "" })

export function editorDocumentToMarkdown(document: JSONContent): string {
  const markdown = renderToMarkdown({
    content: document,
    extensions,
    options: {
      nodeMapping: {
        taskList({ children }) {
          return `\n${flatten(children)}\n`
        },
        taskItem({ node, children }) {
          const checked = node?.attrs?.checked === true

          return `- [${checked ? "x" : " "}] ${flatten(children).trim()}\n`
        },
        hardBreak() {
          return "  \n"
        },
        codeBlock({ node, children }) {
          const language =
            typeof node?.attrs?.language === "string" && node.attrs.language !== ""
              ? node.attrs.language
              : ""

          return `\n\`\`\`${language}\n${flatten(children).trim()}\n\`\`\`\n`
        },
        text({ node }) {
          const value = node?.text ?? ""

          // Code is literal in both directions. Escaping a backtick inside a fenced
          // block would close the fence.
          if (markNames(node).includes("code")) {
            return value
          }

          return escapeInline(value)
        },
      },
    },
  })

  return normalize(markdown)
}

function markNames(node?: MarkedNode | null): string[] {
  return (node?.marks ?? []).map((mark) => {
    const type = mark.type

    if (typeof type === "string") {
      return type
    }

    return type !== null && typeof type === "object" && "name" in type
      ? String(type.name ?? "")
      : ""
  })
}

/**
 * The renderer hands over a document node and the editor hands over its JSON, and the
 * two only agree on the shape this function actually reads: the names of the marks on
 * a run of text.
 */
interface MarkedNode {
  marks?: readonly { type?: unknown }[]
}

/**
 * The characters a plain run of text has to escape so that Markdown reads back as the
 * same characters.
 *
 * `*`, backtick, `[`, `]`, `<` and `\` always need it. `_` only does when it is not
 * inside a word, because CommonMark does not read `some_variable_name` as emphasis,
 * and a note full of identifiers should not come back covered in backslashes.
 */
function escapeInline(text: string): string {
  const withoutLiteralSyntax = text.replace(/[\\`*[\]<>]/g, "\\$&")

  return withoutLiteralSyntax.replace(/_/g, (match, offset: number, whole: string) => {
    const before = offset === 0 ? "" : (whole[offset - 1] ?? "")
    const after = whole[offset + 1] ?? ""

    const isWordCharacter = (character: string) => /[A-Za-z0-9]/.test(character)

    return isWordCharacter(before) && isWordCharacter(after)
      ? match
      : "\\_"
  })
}

/**
 * The renderer's blocks are joined generously, which is harmless for reading and
 * untidy for a `.md` file someone opens in a text editor. One blank line between
 * blocks is the convention, so that is what storage gets. A trailing run of two or
 * more spaces is a hard break and is left alone.
 */
function normalize(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    // A run of one trailing space is stray whitespace; two or more is a hard break.
    .replace(/[ \t]+$/gm, (run) => (run.length === 1 ? "" : run))
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function flatten(children: unknown): string {
  if (typeof children === "string") {
    return children
  }

  if (Array.isArray(children)) {
    return children.map((child) => flatten(child)).join("")
  }

  return ""
}