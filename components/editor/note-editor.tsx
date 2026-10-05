"use client"

import { useId, useRef, useState, type ReactNode } from "react"
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

/**
 * The note editing surface. Mount with a `key` of the note id: each note then
 * owns an isolated draft that is flushed through the mutation queue on unmount,
 * and opens its own editor from its own Markdown.
 *
 * Everything around the document is held here rather than inside it: the mode switch
 * and the panel are one accessibility pair, the formatting row belongs above the
 * writing surface rather than inside it, and the link form is opened from that row.
 * The editor itself is the document, and reports the instance the row acts on.
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
  const { draft, status, saveError, edit, flush } = useNoteDraft(
    note,
    autosaveAbandoned,
  )

  const isPreview = mode === "preview"
  // An empty stored title stays empty; only the display label substitutes.
  const displayTitle =
    draft.title.trim() === "" ? UNTITLED_NOTE_LABEL : draft.title

  /*
   * The expanded view is the same editor in the same place, given the whole window,
   * rather than a second copy of the note: nothing is re-rendered, so the caret, the
   * undo stack and the draft are the ones the reader already had.
   */
  const toggleExpanded = () => {
    if (isExpanded) {
      setExpanded(false)
      /* Back to the control that left it, so the way out is where it was left. */
      expandControlRef.current?.focus()

      return
    }

    setExpanded(true)
    /* And into the document, which is what an expanded writing area is for. */
    editor?.view.dom.focus()
  }

  return (
    <div
      className="editor"
      data-expanded={isExpanded ? "true" : undefined}
      onKeyDown={(event) => {
        /*
         * Escape leaves the expanded view, wherever the focus is inside the note. It
         * stops there rather than travelling, so the shell does not also treat it as
         * dismissing whatever it has open behind the editor.
         */
        if (isExpanded && event.key === "Escape") {
          event.stopPropagation()
          setExpanded(false)
          expandControlRef.current?.focus()
        }
      }}
    >
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

      <div className="editor__toolbar-row">
        <EditorModeTabs mode={mode} onChange={setMode} baseId={baseId} />

        {/*
          At the writing area's top right, on the edge it shares with the panel below.
          A reader looks for the size of a page at its corner, and a control floating
          over the note would either cover a line of it or take height away from it on
          the phone, where there is least of both.
        */}
        <button
          ref={expandControlRef}
          type="button"
          className="editor-expand"
          aria-expanded={isExpanded}
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

      {/*
        The footer closes the editor, and it is the last thing reached in both the
        visual order and the tab order: title, tags, Edit/Preview, content, then the
        state of the save, the way out of the note as a file, and the one destructive
        action. Keeping the status here rather than beside the mode tabs also stops it
        from competing with them for the same row on a narrow screen, and putting
        export before delete keeps the destructive action last in both orders.
      */}
      <div className="editor__footer">
        <SaveStatusIndicator status={status} error={saveError} />

        <ExportMenu title={draft.title} content={draft.content} />

        {deleteControl}
      </div>
    </div>
  )
}