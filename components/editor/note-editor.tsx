"use client"

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react"
import type { Editor } from "@tiptap/core"
import { Maximize2, Minimize2 } from "lucide-react"

import { EditorModeTabs, type EditorMode } from "@/components/editor/editor-mode-tabs"
import { EditorToolbar } from "@/components/editor/editor-toolbar"
import { ExportMenu } from "@/components/editor/export-menu"
import { RichTextEditor } from "@/components/editor/rich-text-editor"
import { SaveStatusIndicator } from "@/components/editor/save-status"
import { TagEditor } from "@/components/editor/tag-editor"
import { useNoteDraft } from "@/components/editor/use-note-draft"
import { useShell } from "@/components/shell/shell-provider"
import { UNTITLED_NOTE_LABEL } from "@/lib/notes/selectors"
import type { Note } from "@/types/note"

interface NoteEditorProps {
  note: Note
  deleteControl: ReactNode
  /**
   * Set once the note is being deleted. Stops autosave so the discarded draft
   * is never written back after the delete has landed.
   */
  autosaveAbandoned?: boolean
}

/*
 * What the expanded window can hold focus on, in DOM order.
 *
 * The document is in the list on its `contenteditable`, not only on a tabindex: a
 * boundary that could not step into the note would strand the reader outside the very
 * thing they opened the window for. In Preview the same element carries `tabindex="0"`
 * instead, so the panel and the document both answer there too.
 */
const FOCUSABLE_IN_WINDOW = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(", ")

/**
 * The note editing surface. Mount with a `key` of the note id: each note then
 * owns an isolated draft that is flushed through the mutation queue on unmount,
 * and opens its own editor from its own Markdown.
 *
 * Everything around the document is held here rather than inside it: the mode switch
 * and the panel are one accessibility pair, the formatting row belongs above the
 * writing surface rather than inside it, and the link form is opened from that row.
 * The editor itself is the document, and reports the instance the row acts on.
 *
 * It also owns the expanded writing window, which is this same document given the
 * whole screen behind a backdrop. Nothing is remounted to open it or to close it, so
 * the caret, the undo stack and the draft are the reader's own throughout.
 */
export function NoteEditor({
  note,
  deleteControl,
  autosaveAbandoned = false,
}: NoteEditorProps) {
  const baseId = useId()
  const { setTitleRef } = useShell()
  const titleId = `${baseId}-title`
  const [mode, setMode] = useState<EditorMode>("edit")
  const [editor, setEditor] = useState<Editor | null>(null)
  const [isLinkMenuOpen, setLinkMenuOpen] = useState(false)
  const [isExpanded, setExpanded] = useState(false)
  const expandControlRef = useRef<HTMLButtonElement>(null)
  const writingRef = useRef<HTMLDivElement>(null)
  const { draft, status, saveError, edit, flush } = useNoteDraft(
    note,
    autosaveAbandoned,
  )

  const isPreview = mode === "preview"
  // An empty stored title stays empty; only the display label substitutes.
  const displayTitle =
    draft.title.trim() === "" ? UNTITLED_NOTE_LABEL : draft.title

  /*
   * Every way out of the window lands here, and each of them puts the focus back on
   * the control that opened it. The control never unmounts and never moves, so the way
   * out is always where the way in was.
   */
  const closeExpanded = () => {
    setExpanded(false)
    expandControlRef.current?.focus()
  }

  const toggleExpanded = () => {
    if (isExpanded) {
      closeExpanded()

      return
    }

    setExpanded(true)
    /* And into the document, which is what an expanded writing area is for. */
    editor?.view.dom.focus()
  }

  /*
   * Escape, and the keyboard's own way round the edge of the window.
   *
   * The window is a modal, so Tab has to stop at its own first and last focusable
   * rather than walking on into the note list and the shell behind the backdrop. The
   * platform would do both of these for a native `<dialog>`, but that element is either
   * open or it is the editor's place in the page, and it cannot be both without a rule
   * that hides a closed dialog — which is the bug the app's own dialogs are written to
   * avoid. So the boundary is written here, and it only applies while it is a window.
   */
  const handleWritingKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isExpanded) {
      return
    }

    if (event.key === "Escape") {
      /*
       * Stops here rather than travelling, so the shell does not also treat it as
       * dismissing whatever it has open behind the editor.
       */
      event.stopPropagation()
      closeExpanded()

      return
    }

    if (event.key !== "Tab") {
      return
    }

    const layer = writingRef.current

    if (layer === null) {
      return
    }

    const focusable = Array.from(
      layer.querySelectorAll<HTMLElement>(FOCUSABLE_IN_WINDOW),
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (first === undefined || last === undefined) {
      return
    }

    const active = document.activeElement

    /*
     * Wrapping rather than skipping, so the edge is one place in both directions. And
     * if the focus has somehow ended up outside the window, the next stop is inside it
     * again rather than wherever the pointer left it.
     */
    if (active === null || !layer.contains(active)) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()

      return
    }

    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  /*
   * A pointer that lands on the window itself landed on the area around the card, which
   * is what a reader means by clicking outside it. Everything in the card is somewhere
   * else in the tree, so the note and its controls cannot be mistaken for the backdrop.
   * The same hit test the confirm and Personalize dialogs use.
   */
  const handleWritingClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === writingRef.current) {
      closeExpanded()
    }
  }

  return (
    <div className="editor">
      {/*
        The title input is the visible title in both modes. The heading stays
        in the accessibility tree so the page keeps exactly one h1 and note
        Markdown can never compete with it.
      */}
      <h1 className="visually-hidden">{displayTitle}</h1>

      <label className="visually-hidden" htmlFor={titleId}>
        Note title
      </label>

      <input
        ref={setTitleRef}
        id={titleId}
        type="text"
        className="editor__title-input"
        value={draft.title}
        placeholder={UNTITLED_NOTE_LABEL}
        autoComplete="off"
        onChange={(event) => edit({ title: event.target.value })}
        onBlur={() => void flush()}
      />

      <TagEditor tags={draft.tags} onChange={(tags) => edit({ tags })} />

      {/*
        The writing window: in the flow, a plain column between the tags and the
        footer; expanded, the glass over the whole app with the same toolbar, the same
        panel and the same document inside it.

        It is a dialog by role rather than by element, and only while it is open — an
        ordinary column that is announced as a dialog would be a lie about the page it
        is standing in.
      */}
      <div
        ref={writingRef}
        className="editor__writing"
        data-expanded={isExpanded ? "true" : undefined}
        role={isExpanded ? "dialog" : undefined}
        aria-modal={isExpanded ? "true" : undefined}
        aria-label={
          isExpanded ? `${displayTitle} — expanded writing area` : undefined
        }
        onKeyDown={handleWritingKeyDown}
        onClick={handleWritingClick}
      >
        <div className="editor__writing-surface">
          <div className="editor__toolbar-row">
            <EditorModeTabs mode={mode} onChange={setMode} baseId={baseId} />

            {/*
              At the writing area's top right, on the edge it shares with the panel below.
              A reader looks for the size of a page at its corner, and a control floating
              over the note would either cover a line of it or take height away from it on
              the phone, where there is least of both. It is the one control inside the
              window, so it doubles as the way out of it.
            */}
            <button
              ref={expandControlRef}
              type="button"
              className="editor-expand"
              aria-expanded={isExpanded}
              aria-haspopup="dialog"
              aria-label={
                isExpanded ? "Close expanded writing area" : "Expand writing area"
              }
              title={isExpanded ? "Close expanded writing area" : "Expand writing area"}
              onClick={toggleExpanded}
            >
              {isExpanded ? (
                <Minimize2 aria-hidden="true" className="editor-expand__icon" />
              ) : (
                <Maximize2 aria-hidden="true" className="editor-expand__icon" />
              )}
            </button>
          </div>

          {!isPreview && (
            /*
              The formatting row sits above the writing surface rather than inside it. The
              panel draws the boundary of the document and the ring around it, and a row of
              controls drawn inside that boundary reads as part of the note's own text area
              instead of as controls for it.
            */
            <EditorToolbar editor={editor} onEditLink={() => setLinkMenuOpen(true)} />
          )}

          {/*
            One panel, one editor, and the tab decides whether it can be written in.

            The Preview tab is not a second rendering of the note: it is this same
            document with the editing turned off. Showing one document is what keeps
            the preview from ever disagreeing with the editor, and keeping one editor
            across the switch is what leaves undo and the caret where the reader left
            them when they glance at the preview and come back.

            The panel holds the document and nothing else, and it is where the writing
            area's boundary is drawn in both modes, because Edit and Preview are the same
            surface with the writing turned off.
          */}
          <div
            role="tabpanel"
            id={isPreview ? `${baseId}-panel-preview` : `${baseId}-panel-edit`}
            aria-labelledby={isPreview ? `${baseId}-tab-preview` : `${baseId}-tab-edit`}
            tabIndex={isPreview ? 0 : undefined}
            className={
              isPreview ? "editor__panel editor__panel--preview" : "editor__panel"
            }
          >
            <RichTextEditor
              markdown={draft.content}
              placeholder="Write your note…"
              editable={!isPreview}
              onChange={(content) => edit({ content })}
              onBlur={() => void flush()}
              onEditorReady={setEditor}
              isLinkMenuOpen={isLinkMenuOpen}
              onLinkMenuOpenChange={setLinkMenuOpen}
            />
          </div>
        </div>
      </div>

      {/*
        The footer closes the editor, and it is the last thing reached in both the
        visual order and the tab order: title, tags, Edit/Preview, content, then the
        state of the save, the way out of the note as a file, and the one destructive
        action. Keeping the status here rather than beside the mode tabs also stops it
        from competing with them for the same row on a narrow screen, and putting
        export before delete keeps the destructive action last in both orders.

        It stays outside the window, behind the backdrop: saving, exporting and
        deleting are for the note when it is being read as a document, and the window is
        for the document while it is being written.
      */}
      <div className="editor__footer">
        <SaveStatusIndicator status={status} error={saveError} />

        <ExportMenu title={draft.title} content={draft.content} />

        {deleteControl}
      </div>
    </div>
  )
}
