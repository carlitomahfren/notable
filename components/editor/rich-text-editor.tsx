"use client"

import { useEffect, useRef } from "react"
import type { Editor } from "@tiptap/core"
import { EditorContent, useEditor } from "@tiptap/react"
import { selectAll } from "@tiptap/pm/commands"

import { LinkMenu } from "@/components/editor/link-menu"
import { publishEditor } from "@/lib/editor/editor-registry"
import { noteEditorExtensions } from "@/lib/editor/extensions"
import { markdownToEditorHtml } from "@/lib/editor/parse-markdown"
import { editorDocumentToMarkdown } from "@/lib/editor/serialize-markdown"

interface RichTextEditorProps {
  /** The note as it is stored. Read once: this is what the editor is opened with. */
  markdown: string
  placeholder: string
  editable: boolean
  onChange: (markdown: string) => void
  onBlur: () => void
  /**
   * The instance this editor owns, reported as it is built.
   *
   * The formatting row sits above the panel rather than inside it, so the row is not
   * inside this component and still has to reach the editor it acts on. Reporting it
   * is how that is done without the document being rendered twice or the instance
   * being dug back out of the DOM.
   */
  onEditorReady?: (editor: Editor | null) => void
  /** Whether the link form is open. It is owned above this component, beside the control that opens it. */
  isLinkMenuOpen?: boolean
  onLinkMenuOpenChange?: (isOpen: boolean) => void
}

/**
 * The note's writing surface: rich text on screen, Markdown in storage.
 *
 * The reader types into a document rather than into its own source. There is no mode in
 * which asterisks or hash signs are something to be typed or seen, and there is no
 * rendered copy laid over a transparent field pretending to be one; this is the text,
 * in the text's own type, in one editable element.
 *
 * That is possible because the note model did not have to change. Markdown is what the
 * note has always been on disk, and it is still what is written there: the document is
 * read out of the Markdown when the note opens, and written back into it on every edit.
 * The same document is also what the Preview tab shows, read-only, so the preview cannot
 * drift from the editor the way a second renderer always eventually does.
 *
 * Three details are load-bearing:
 *
 * - The editor is created once per note. `NoteEditor` is mounted with the note id as its
 *   key, so a new note is a new editor with the new note's Markdown, and an autosave
 *   landing back in storage cannot reset the text under the reader's caret.
 * - Every update is serialized back to Markdown before it leaves the editor, which means
 *   autosave, exports and storage all see exactly the same note.
 * - The editor is not created during render on the server. `immediatelyRender: false`
 *   lets the document be built after hydration, so the markup the server sends and the
 *   document the browser opens cannot disagree about what a note is.
 * - Only Markdown that differs from what this editor already holds is reported. An
 *   editor reports an update when it is built and again when editing is switched off,
 *   both of which are the same words arranged the same way; a note the reader has not
 *   touched must not go dirty just because it was opened.
 * - The formatting row is not part of this either. It sits above the panel rather than
 *   inside it, so the panel holds the document and nothing else, and the row is handed
 *   the instance to act on instead of the document being rendered twice to reach it.
 */
export function RichTextEditor({
  markdown,
  placeholder,
  editable,
  onChange,
  onBlur,
  onEditorReady,
  isLinkMenuOpen = false,
  onLinkMenuOpenChange,
}: RichTextEditorProps) {
  /* The Markdown this editor last had, or was opened with. */
  const reportedRef = useRef(markdown)

  const editor = useEditor({
    extensions: noteEditorExtensions({ placeholder }),
    content: markdownToEditorHtml(markdown),
    immediatelyRender: false,
    editable,
    editorProps: {
      attributes: {
        class: "rich-text__prose",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Note content",
        spellcheck: "true",
        /*
         * A read-only document holds no caret, so it would not be reachable by keyboard
         * to be scrolled. It is given a tab stop instead, and the panel around it does
         * the same, so a long note can always be read without a pointer.
         */
        ...(editable ? {} : { "aria-readonly": "true", tabindex: "0" }),
      },
      /*
       * Everything else a reader expects from a text field is the editor's own: Enter for
       * a new block, Backspace to join two, arrow keys, selection, paste, and the
       * platform's undo. Two shortcuts are worth naming here, because both are the
       * editor's to answer rather than the browser's.
       *
       * The link is one: a link needs an address and has nowhere to ask for one from the
       * keyboard, so Mod-K opens the editor's own form for it.
       *
       * Select-all is the other. Left to the browser it is a guess about what a
       * contenteditable region is, and the guesses differ: the note's text on one, the
       * whole page on another, the page again on an empty note. A reader pressing Ctrl-A
       * with the caret in a note means the note, so the note is what is selected here,
       * with the browser's own selection stopped before it runs.
       */
      handleKeyDown: (view, event) => {
        const key = event.key.toLowerCase()

        if (!event.metaKey && !event.ctrlKey) {
          return false
        }

        if (event.altKey) {
          return false
        }

        if (key === "k") {
          event.preventDefault()
          onLinkMenuOpenChange?.(true)

          return true
        }

        if (key === "a") {
          /*
           * Focused first, because a selection written into a region that is not the
           * active one is a selection nothing can see.
           */
          view.focus()
          selectAll(view.state, view.dispatch)
          event.preventDefault()

          return true
        }

        return false
      },
    },
    onUpdate: ({ editor: instance }) => {
      const next = editorDocumentToMarkdown(instance.getJSON())

      if (next === reportedRef.current) {
        return
      }

      reportedRef.current = next
      onChange(next)
    },
    onBlur,
  })

  /* Reading the note again from storage must not look like the reader writing. */
  useEffect(() => {
    reportedRef.current = markdown
  }, [markdown])

  /* The Preview tab shows this same document rather than a second copy of the note. */
  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  /* Publishing the instance for its own element is what lets a test drive it. */
  useEffect(() => {
    if (editor === null) {
      return
    }

    const element = editor.view.dom

    if (element instanceof HTMLElement) {
      publishEditor(element, editor)
    }
  }, [editor])

  /* And the instance itself goes to whoever is holding the controls that act on it. */
  useEffect(() => {
    onEditorReady?.(editor)

    return () => {
      onEditorReady?.(null)
    }
  }, [editor, onEditorReady])

  return (
    <div
      className="rich-text"
      onBlur={(event) => {
        /*
         * Closing the dialog on the way out of the whole surface, but not on the way
         * between two controls inside it, so applying a link does not dismiss the form
         * it was applied from.
         */
        const destination = event.relatedTarget

        if (
          !(destination instanceof Node) ||
          !event.currentTarget.contains(destination)
        ) {
          onLinkMenuOpenChange?.(false)
        }
      }}
    >
      {editable && editor !== null && isLinkMenuOpen && (
        /* Mounted only while open, so each opening starts from the link in hand. */
        <LinkMenu editor={editor} onClose={() => onLinkMenuOpenChange?.(false)} />
      )}

      <EditorContent editor={editor} className="rich-text__surface" />
    </div>
  )
}