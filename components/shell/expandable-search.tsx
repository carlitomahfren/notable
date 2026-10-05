"use client"

import { useEffect, useId, useRef } from "react"
import { Search, X } from "lucide-react"

import { useShell } from "@/components/shell/shell-provider"

interface ExpandableSearchProps {
  value: string
  onChange: (value: string) => void
  resultCount: number
}

/**
 * Search starts as a single icon button so the navigation bar stays compact, then
 * expands into a real text field. The query itself always lives in the workspace,
 * so collapsing the field only changes what is on screen and never what is being
 * filtered.
 *
 * The collapsed button and the expanded field swap places rather than sitting side
 * by side. Two magnifying glasses at once read as a mistake, and the field carries
 * its own icon, so the standalone one is hidden the instant the field appears. It
 * is hidden rather than unmounted because it is the focus target that Escape and
 * the close button hand control back to.
 */
export function ExpandableSearch({ value, onChange, resultCount }: ExpandableSearchProps) {
  const { isSearchOpen, openSearch, closeSearch } = useShell()
  const inputRef = useRef<HTMLInputElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreFocusRef = useRef(false)
  const fieldId = useId()
  const statusId = `${fieldId}-status`

  const hasQuery = value.trim() !== ""

  useEffect(() => {
    if (isSearchOpen) {
      inputRef.current?.focus()
    }
  }, [isSearchOpen])

  /*
   * Focus cannot simply be moved as the field closes: the button it belongs to is
   * `hidden` until the same commit finishes, and focusing a hidden element is a
   * no-op. The request is therefore parked and honoured once the button is back.
   */
  useEffect(() => {
    if (isSearchOpen || !shouldRestoreFocusRef.current) {
      return
    }

    shouldRestoreFocusRef.current = false
    toggleRef.current?.focus()
  }, [isSearchOpen])

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        openSearch()
      }
    }

    window.addEventListener("keydown", onShortcut)

    return () => window.removeEventListener("keydown", onShortcut)
  }, [openSearch])

  function requestClose() {
    shouldRestoreFocusRef.current = true
    closeSearch()
  }

  function onFieldKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape") {
      return
    }

    event.preventDefault()

    /*
     * The first Escape clears a filter rather than dismissing a field the user may
     * still be typing in. Closing first would throw the query away with no way back
     * to it, which makes the key feel destructive.
     */
    if (hasQuery) {
      onChange("")
      return
    }

    requestClose()
  }

  return (
    <div className="shell-search" data-open={isSearchOpen}>
      <button
        ref={toggleRef}
        type="button"
        className="shell-search__toggle"
        hidden={isSearchOpen}
        aria-expanded={isSearchOpen}
        aria-controls={fieldId}
        aria-label={
          hasQuery
            ? "Search notes, a filter is active"
            : "Search notes"
        }
        data-has-query={hasQuery ? "" : undefined}
        onClick={openSearch}
      >
        <Search aria-hidden="true" className="shell-search__toggle-icon" />
      </button>

      {/*
        The field animates in from the width of the button it replaces, so the
        control appears to grow rather than to be swapped. `@starting-style` supplies
        the "before" state for the `hidden` reveal; where it is unsupported the
        field simply appears, which is a safe fallback.
      */}
      <div className="shell-search__field" hidden={!isSearchOpen}>
        <label className="visually-hidden" htmlFor={fieldId}>
          Search notes
        </label>

        <Search aria-hidden="true" className="shell-search__field-icon" />

        <input
          ref={inputRef}
          id={fieldId}
          type="search"
          className="shell-search__input"
          value={value}
          placeholder="Search notes"
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-describedby={hasQuery ? statusId : undefined}
        />

        <button
          type="button"
          className="shell-search__close"
          onClick={requestClose}
          aria-label="Close search"
        >
          <X aria-hidden="true" />
        </button>

        <p id={statusId} className="visually-hidden" role="status">
          {hasQuery
            ? `${resultCount} ${resultCount === 1 ? "note" : "notes"} match your search.`
            : ""}
        </p>
      </div>
    </div>
  )
}