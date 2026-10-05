import MarkdownIt from "markdown-it"

import { taskLists } from "@/lib/editor/markdown-it-task-lists"

/**
 * Markdown in, editor content out.
 *
 * The note is stored as Markdown because Markdown is portable, readable in a text
 * file, and what every export format already speaks. The editor is a rich text
 * surface because that is what writing is. This module is the seam between the two,
 * and it exists in both directions:
 *
 *     Note.content -> markdownToEditorHtml -> the document the editor opens
 *     the document the editor holds -> editorDocumentToMarkdown -> Note.content
 *
 * Nothing about Markdown is allowed to reach the screen. The parser produces HTML
 * that Tiptap's schema accepts, and an element the schema does not know is dropped
 * with its text kept, so a hand-written note cannot smuggle markup into the editor.
 *
 * On the way out the document is serialized with the same extensions the editor was
 * built from, so a name that means "checklist" means it in both directions.
 */
const parser = new MarkdownIt({
  // Inline HTML is how underline is spelled in Markdown, because Markdown has no
  // underline syntax. It is also why the notes in storage stay portable: `<u>` is
  // valid Markdown and every renderer handles it.
  html: true,
  // A bare address typed in a note becomes a link, which is what every writing
  // surface does and what people expect from pasting a URL.
  linkify: true,
  typographer: false,
})

parser.use(taskLists)

/**
 * Reads stored Markdown as HTML for the editor to open.
 *
 * This is deliberately the full Markdown parser rather than the small block reader
 * the exports use: the exports only have to draw a note, while this has to be able to
 * lose nothing.
 */
export function markdownToEditorHtml(markdown: string): string {
  if (markdown.trim() === "") {
    return ""
  }

  return parser.render(markdown)
}