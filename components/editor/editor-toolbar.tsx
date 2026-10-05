"use client"

import type { Editor } from "@tiptap/core"
import { useEditorState } from "@tiptap/react"
import type { LucideIcon } from "lucide-react"
import {
  Bold,
  Code,
  Heading,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react"

/** The platform's own name for the modifier, so a tooltip can be read at a glance. */
const MODIFIER = /(Mac|iPhone|iPad|iPod)/.test(
  typeof navigator === "undefined" ? "" : navigator.platform,
)
  ? "⌘"
  : "Ctrl+"

interface ToolbarButton {
  key: string
  label: string
  Icon: LucideIcon
  /** The shortcut as assistive technology spells it, or null for a control with none. */
  shortcut: string | null
  /** A format is a state the reader can query; undo is something they can do. */
  isToggle: boolean
  isActive: (editor: Editor) => boolean
  run: (editor: Editor) => void
}

/**
 * The formatting row.
 *
 * These are the same icons the app has always used for these meanings, and the same set
 * of controls the Markdown toolbar had, so nothing moves. What changed is what they act
 * on: each one is a document command rather than a rewrite of the source text, which is
 * why a reader never sees the caret inside a marker, and why the toolbar can say whether
 * a format is already on.
 *
 * Every command takes focus back before it runs. A button takes focus when it is
 * clicked, and a document command applied to a selection the editor has stopped owning
 * would either do nothing or lose the very selection it was meant for.
 *
 * The link control opens a dialog instead of applying a format, because a link needs an
 * address typed into it. `Mod-K` reaches the same dialog from inside the text.
 *
 * Undo and redo are here for the reason they are in every word processor: the browser's
 * own undo button belongs to the page, not to the note.
 */
const BUTTONS: ToolbarButton[] = [
  {
    key: "bold",
    label: "Bold",
    Icon: Bold,
    shortcut: "Mod+B",
    isToggle: true,
    isActive: (editor) => editor.isActive("bold"),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    key: "italic",
    label: "Italic",
    Icon: Italic,
    shortcut: "Mod+I",
    isToggle: true,
    isActive: (editor) => editor.isActive("italic"),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    /*
     * The largest heading in a note is level 2: the note's title is already the page's
     * one h1, and a note must not compete with its own title for that role.
     */
    key: "heading",
    label: "Heading",
    Icon: Heading,
    shortcut: null,
    isToggle: true,
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: "bulletList",
    label: "Bulleted list",
    Icon: List,
    shortcut: null,
    isToggle: true,
    isActive: (editor) => editor.isActive("bulletList"),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    key: "orderedList",
    label: "Numbered list",
    Icon: ListOrdered,
    shortcut: null,
    isToggle: true,
    isActive: (editor) => editor.isActive("orderedList"),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    key: "taskList",
    label: "Checklist",
    Icon: ListChecks,
    shortcut: null,
    isToggle: true,
    isActive: (editor) => editor.isActive("taskList"),
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    key: "link",
    label: "Link",
    Icon: Link,
    shortcut: "Mod+K",
    isToggle: true,
    isActive: (editor) => editor.isActive("link"),
    run: () => undefined,
  },
  {
    key: "code",
    label: "Code",
    Icon: Code,
    shortcut: "Mod+E",
    isToggle: true,
    isActive: (editor) => editor.isActive("code"),
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    key: "blockquote",
    label: "Quote",
    Icon: Quote,
    shortcut: null,
    isToggle: true,
    isActive: (editor) => editor.isActive("blockquote"),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    key: "undo",
    label: "Undo",
    Icon: Undo2,
    shortcut: "Mod+Z",
    isToggle: false,
    isActive: () => false,
    run: (editor) => editor.chain().focus().undo().run(),
  },
  {
    key: "redo",
    label: "Redo",
    Icon: Redo2,
    shortcut: "Mod+Shift+Z",
    isToggle: false,
    isActive: () => false,
    run: (editor) => editor.chain().focus().redo().run(),
  },
]

interface EditorToolbarProps {
  editor: Editor | null
  onEditLink: () => void
}

/**
 * Reads the editor's selection rather than its content, so the row answers "is bold on
 * where the caret is" without re-rendering on every keystroke. `useEditorState` is what
 * makes that distinction: it re-renders when the answer changes, not when the note does.
 */
export function EditorToolbar({ editor, onEditLink }: EditorToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      const flags: Record<string, boolean> = {}

      for (const button of BUTTONS) {
        flags[button.key] = instance === null ? false : button.isActive(instance)
      }

      return {
        flags,
        /*
         * Undo and redo are unavailable when there is nothing to undo, which is a
         * different thing from being turned off: the control stays in the row, in
         * place, so the row does not rearrange itself under the reader's hands.
         */
        canUndo: instance?.can().chain().undo().run() ?? false,
        canRedo: instance?.can().chain().redo().run() ?? false,
      }
    },
  })

  if (editor === null || state === null) {
    return null
  }

  return (
    <div className="editor-toolbar" role="group" aria-label="Formatting">
      {BUTTONS.map((button) => (
        <button
          key={button.key}
          type="button"
          className="editor-toolbar__button"
          /*
           * A format that is on is a state, so it is pressed rather than merely
           * coloured; that is also what tells a screen reader it is applied.
           */
          aria-pressed={
            button.isToggle ? (state.flags[button.key] ?? false) : undefined
          }
          aria-label={button.label}
          aria-keyshortcuts={button.shortcut ?? undefined}
          title={readableTitle(button)}
          disabled={
            button.key === "undo"
              ? !state.canUndo
              : button.key === "redo"
                ? !state.canRedo
                : false
          }
          onClick={() => {
            if (button.key === "link") {
              onEditLink()
              return
            }

            button.run(editor)
          }}
        >
          <button.Icon aria-hidden="true" className="editor-toolbar__icon" />
        </button>
      ))}
    </div>
  )
}

/** `Mod+K` for the markup, `Ctrl+K` or `⌘K` for the tooltip. */
function readableTitle(button: ToolbarButton): string {
  if (button.shortcut === null) {
    return button.label
  }

  return `${button.label} (${button.shortcut.replace(/^Mod\+/, MODIFIER)})`
}