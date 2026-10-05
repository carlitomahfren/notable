"use client"

import { useId, useRef, useState, type KeyboardEvent } from "react"

interface TagEditorProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

/**
 * Tag editing that only collects user input. Normalization stays at the service
 * boundary, so the chips a user sees are replaced by the canonical values the
 * service returns once a save succeeds.
 */
export function TagEditor({ tags, onChange }: TagEditorProps) {
  const groupId = useId()
  const inputId = `${groupId}-input`
  const hintId = `${groupId}-hint`
  const inputRef = useRef<HTMLInputElement>(null)
  const [entry, setEntry] = useState("")

  // Commas delimit input here purely to tokenize what the user typed; the
  // service still owns trimming, casing, prefix, dedupe, and rejection.
  const commitEntry = () => {
    const entered = entry.split(",").map((part) => part.trim()).filter(Boolean)

    if (entered.length === 0) {
      setEntry("")
      return
    }

    onChange([...tags, ...entered])
    setEntry("")
  }

  const removeTag = (index: number) => {
    onChange(tags.filter((_, position) => position !== index))
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      commitEntry()
      return
    }

    // Backspace on an empty field removes the most recent tag.
    if (event.key === "Backspace" && entry === "" && tags.length > 0) {
      event.preventDefault()
      removeTag(tags.length - 1)
    }
  }

  return (
    <div className="editor-tags">
      <span className="editor-field__label" id={groupId}>
        Tags
      </span>

      <ul className="editor-tags__list" aria-labelledby={groupId}>
        {tags.map((tag, index) => (
          <li key={`${tag}-${index}`} className="editor-tags__chip">
            <span className="editor-tags__name">#{tag}</span>

            <button
              type="button"
              className="editor-tags__remove"
              onClick={() => removeTag(index)}
              aria-label={`Remove tag ${tag}`}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>

      <label className="visually-hidden" htmlFor={inputId}>
        Add tag
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="text"
        className="editor-tags__input"
        value={entry}
        placeholder="Add a tag"
        autoComplete="off"
        aria-describedby={hintId}
        onChange={(event) => setEntry(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitEntry}
      />

      <p className="editor-field__hint" id={hintId}>
        Press Enter or comma to add a tag. Backspace removes the last one.
      </p>
    </div>
  )
}