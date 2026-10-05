import { mergeAttributes, type Extensions } from "@tiptap/core"
import Heading from "@tiptap/extension-heading"
import { Placeholder } from "@tiptap/extension-placeholder"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import StarterKit from "@tiptap/starter-kit"

/**
 * Every stored heading level is drawn one level down.
 *
 * The note's title is already the page's one h1, and a note is not allowed to compete
 * with its own title for that role: two h1s on a screen is one heading too many for the
 * page outline to say anything useful. So a stored `# Heading` is read as level 1 and
 * drawn as an h2, `##` as an h3, and so on down to `# ######` as an h6.
 *
 * Only the drawing changes. Level 1 is still level 1 in the document, so the note is
 * still written out as `# Heading` and still exports as one: nothing about the stored
 * note is rewritten to satisfy a page rule.
 *
 * The shift applies to every level rather than to the first alone, because shifting
 * only the first is how `#` and `##` end up as two h2s of one size. A reader has to be
 * able to see that the second is smaller than the first.
 */
const NoteHeading = Heading.extend({
  renderHTML({ node, HTMLAttributes }) {
    const level = typeof node.attrs.level === "number" ? node.attrs.level : 1
    /*
     * Clamped at six because that is the last heading tag there is, and a note that
     * reaches level 5 has already run out of room to go down.
     */
    const drawn = Math.min(Math.max(level, 1) + 1, 6)

    /*
     * The trailing zero is where the heading's own text goes. A spec without it
     * renders an empty element, which is exactly as wrong as it sounds: the document
     * would hold the words and the page would show none of them.
     */
    return [
      `h${drawn}`,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ]
  },
})

/**
 * What the note body can contain.
 *
 * This is the schema of a note, and it is written down once: the editor is built from
 * it, the Markdown is read back through it, and the Markdown is written out through
 * it. If the editor and the serializer were configured separately they would disagree
 * about the name of a node, and a note would silently change shape every time it was
 * saved.
 *
 * `StarterKit` is a bundle rather than a list because it is exactly the set of things
 * a plain note is made of: paragraphs, headings, bold, italic, underline, strike,
 * inline code, fenced code, bullet and numbered lists, blockquotes, hard breaks,
 * horizontal rules, and undo/redo. Two things are not in it and are added here:
 * checklists, which the product requires, and the empty-note placeholder.
 *
 * There is deliberately no table, no image, and no mention. Each would need storage
 * decisions that have not been made yet.
 */
export interface NoteEditorOptions {
  /** The hint shown on an empty note. */
  placeholder: string
}

export function noteEditorExtensions({
  placeholder,
}: NoteEditorOptions): Extensions {
  return [
    StarterKit.configure({
      /* `NoteHeading` replaces it, and only to change how level 1 is drawn. */
      heading: false,
      /*
        Links are written by the editor's own dialog, and clicked links do not move
        the caret: a reader clicking a link to read it should not end up editing it.
      */
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
      },
      codeBlock: {
        // A note is not a script file; a language picker would be a control that
        // does nothing for the reader.
        HTMLAttributes: { class: "rich-text__code-block" },
      },
    }),

    NoteHeading,

    TaskList,
    TaskItem.configure({ nested: true }),

    Placeholder.configure({
      placeholder,
      // The hint belongs to an empty note, not to every empty block in it: pressing
      // Enter in the middle of a note should not paint a second hint on the line below.
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
      /*
       * Tiptap draws an empty note and an empty block with two different classes, and
       * they mean the same thing to a reader. One name for both means the stylesheet has
       * one rule rather than a rule that silently misses the case that matters most: the
       * hint on a note that has nothing in it yet.
       */
      emptyEditorClass: "rich-text--empty",
      emptyNodeClass: "rich-text--empty",
    }),
  ]
}