"use client"

import { useRef, type KeyboardEvent } from "react"

export type EditorMode = "edit" | "preview"

interface EditorModeTabsProps {
  mode: EditorMode
  onChange: (mode: EditorMode) => void
  baseId: string
}

const MODES: EditorMode[] = ["edit", "preview"]

const LABELS: Record<EditorMode, string> = {
  edit: "Edit",
  preview: "Preview",
}

/**
 * A real tablist, so the active mode is programmatically identifiable through
 * `aria-selected` and arrow keys move between tabs as expected.
 */
export function EditorModeTabs({ mode, onChange, baseId }: EditorModeTabsProps) {
  // Buttons are tracked by ref rather than selected by id: `useId` values are
  // not valid in a CSS selector without escaping.
  const tabRefs = useRef(new Map<EditorMode, HTMLButtonElement>())

  const focusTab = (next: EditorMode) => {
    onChange(next)
    tabRefs.current.get(next)?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = MODES.indexOf(mode)

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault()
        focusTab(MODES[(currentIndex + 1) % MODES.length])
        break
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault()
        focusTab(MODES[(currentIndex - 1 + MODES.length) % MODES.length])
        break
      case "Home":
        event.preventDefault()
        focusTab(MODES[0])
        break
      case "End":
        event.preventDefault()
        focusTab(MODES[MODES.length - 1])
        break
      default:
        break
    }
  }

  return (
    <div className="editor-tabs" role="tablist" aria-label="Note view mode" onKeyDown={handleKeyDown}>
      {MODES.map((candidate) => {
        const isActive = candidate === mode

        return (
          <button
            key={candidate}
            type="button"
            role="tab"
            ref={(element) => {
              if (element === null) {
                tabRefs.current.delete(candidate)
              } else {
                tabRefs.current.set(candidate, element)
              }
            }}
            id={`${baseId}-tab-${candidate}`}
            className="editor-tabs__tab"
            aria-selected={isActive}
            aria-controls={`${baseId}-panel-${candidate}`}
            // Roving tabindex: one stop for the whole tablist.
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(candidate)}
          >
            {LABELS[candidate]}
          </button>
        )
      })}
    </div>
  )
}