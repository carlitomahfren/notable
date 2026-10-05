"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Download } from "lucide-react"

import {
  EXPORT_FORMATS,
  type ExportFormatId,
} from "@/lib/export/export-formats"
import { exportNote } from "@/lib/export/note-export"

interface ExportMenuProps {
  title: string
  content: string
}

type ExportState =
  | { kind: "idle" }
  | { kind: "working"; format: ExportFormatId }
  | { kind: "failed"; message: string }

/**
 * Exporting a note.
 *
 * The four formats are a disclosure rather than four buttons because the first two
 * are a keystroke away in a text editor and the other two load a library: putting
 * all of them on screen would promise four equally cheap things. The two that build
 * a file take a moment, so the control says it is working instead of appearing to
 * have done nothing, and says which file arrived afterwards.
 *
 * The note is exported from the draft, not from storage, so what is exported is what
 * is on screen even if the last keystroke has not been saved yet.
 */
export function ExportMenu({ title, content }: ExportMenuProps) {
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [state, setState] = useState<ExportState>({ kind: "idle" })
  const [announcement, setAnnouncement] = useState("")

  const close = useCallback(() => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target

      if (target instanceof Element && target.closest("[data-export-menu]") !== null) {
        return
      }

      setIsOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)

    return () => {
      document.removeEventListener("mousedown", onPointerDown)
    }
  }, [isOpen])

  const run = async (format: ExportFormatId) => {
    setState({ kind: "working", format })
    close()

    try {
      const fileName = await exportNote(format, { title, content })

      setState({ kind: "idle" })
      setAnnouncement(`Exported ${fileName}.`)
    } catch (error) {
      setState({
        kind: "failed",
        message:
          error instanceof Error && error.message !== ""
            ? error.message
            : "The file could not be created.",
      })
    }
  }

  const isWorking = state.kind === "working"

  return (
    <div
      className="export-menu"
      data-export-menu=""
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !isOpen) {
          return
        }

        event.preventDefault()
        close()
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="export-menu__trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setIsOpen((open) => !open)
        }}
      >
        <Download aria-hidden="true" className="export-menu__icon" />
        <span className="export-menu__trigger-label">
          {isWorking ? "Exporting…" : "Export"}
        </span>
      </button>

      <div id={panelId} className="export-menu__panel" hidden={!isOpen}>
        <ul className="export-menu__list">
          {EXPORT_FORMATS.map((format) => (
            <li key={format.id}>
              <button
                type="button"
                className="export-menu__option"
                disabled={isWorking}
                onClick={() => {
                  void run(format.id)
                }}
              >
                <span className="export-menu__format">{format.label}</span>
                <span className="export-menu__extension" aria-hidden="true">
                  .{format.extension}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {state.kind === "failed" ? (
        <p className="export-menu__error" role="alert">
          {state.message}
        </p>
      ) : null}

      {/*
        A download is invisible to a screen reader: the file arrives in a folder the
        user has to go and look in. Naming the file is the only confirmation the page
        can give, so it is announced rather than left to the browser's own message.
      */}
      <span className="visually-hidden" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}