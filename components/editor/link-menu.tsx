"use client"

import { useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/core"
import { useEditorState } from "@tiptap/react"
import { Check, X } from "lucide-react"

interface LinkMenuProps {
  editor: Editor
  onClose: () => void
}

/**
 * The one control in the editor that needs something typed into it.
 *
 * A link is not a mark the reader can toggle onto a selection without saying where it
 * goes, so it cannot be a toolbar button that fires and forgets. This is a small form
 * that opens under the toolbar, starts from the address the selection already has, and
 * closes the way any other small form does: apply, remove, or Escape.
 *
 * The address is normalised the way a browser would read it. `example.com` is a note
 * about a place, not a relative path, so it becomes `https://example.com`; anything
 * that already names a scheme is left exactly as it was, because `mailto:` and `tel:`
 * are links too and guessing at them would break them.
 *
 * This is mounted only while it is open, so each opening starts from the link the caret
 * is in and a cancelled one leaves nothing behind for the next opening to read.
 */
export function LinkMenu({ editor, onClose }: LinkMenuProps) {
  const [value, setValue] = useState(() => {
    const href = editor.getAttributes("link").href

    return typeof href === "string" ? href : ""
  })
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isInsideLink = useEditorState({
    editor,
    selector: ({ editor: instance }) => instance?.isActive("link") ?? false,
  })

  /* The field is the first thing to reach, and a half-written address is not useful. */
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function apply(): void {
    const address = normalizeAddress(value)

    if (address === null) {
      setError("Enter a web address, like example.com.")
      return
    }

    const chain = editor.chain().focus().extendMarkRange("link")

    /*
     * With nothing selected there is no text to mark, so the address itself becomes the
     * text of the new link. Typing a URL and pressing the link button should leave a
     * link behind, not a bare address and a lost keystroke.
     */
    if (editor.state.selection.empty) {
      chain
        .insertContent({
          type: "text",
          text: address,
          marks: [{ type: "link", attrs: { href: address } }],
        })
        .run()
    } else {
      chain.setLink({ href: address }).run()
    }

    onClose()
  }

  function remove(): void {
    editor.chain().focus().extendMarkRange("link").unsetLink().run()
    onClose()
  }

  return (
    <form
      className="link-menu"
      role="group"
      aria-label="Insert link"
onSubmit={(event) => {
          event.preventDefault()
          apply()
        }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <label className="visually-hidden" htmlFor="link-menu-address">
        Link address
      </label>

      <input
        ref={inputRef}
        id="link-menu-address"
        className="link-menu__address"
        /*
         * A text field with a URL keyboard, not `type="url"`. The address a reader is
         * told to type here is `example.com/page`, and a url field's own validity rule
         * says that is not a URL: it would refuse the form's submission and put the
         * browser's "please enter a URL" in front of this app's own advice about what to
         * write. The field takes any text and the normalizer below decides what is an
         * address, which is also the only way `mailto:` and `tel:` survive.
         */
        type="text"
        inputMode="url"
        value={value}
        placeholder="example.com/page"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={error === null ? undefined : "link-menu-error"}
        onChange={(event) => {
          setValue(event.target.value)
          setError(null)
        }}
      />

      <button type="submit" className="link-menu__button" aria-label="Apply link">
        <Check aria-hidden="true" className="link-menu__icon" />
      </button>

      {isInsideLink && (
        <button
          type="button"
          className="link-menu__button"
          aria-label="Remove link"
          onClick={remove}
        >
          <X aria-hidden="true" className="link-menu__icon" />
        </button>
      )}
    </form>
  )
}

/**
 * A web address from a reader, or null if there is not one. A scheme that is already
 * there is trusted; anything else is treated as a host name.
 */
function normalizeAddress(input: string): string | null {
  const trimmed = input.trim()

  if (trimmed === "") {
    return null
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed}`
}