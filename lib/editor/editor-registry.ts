import type { Editor } from "@tiptap/core"

/**
 * Which editor belongs to which element.
 *
 * The toolbar and the link dialog get the editor through props, because they are part
 * of the editor and have every reason to hold it. Nothing outside the editor has any
 * reason to, and this is the one exception: a `contenteditable` element cannot be driven
 * from the outside, so a test has to reach the very instance a reader types into, and
 * so does anyone debugging a note in the browser console.
 *
 * A `WeakMap` keyed by the editor's own element keeps that out of the DOM, out of any
 * global, and out of React's props. The entry disappears with the element, and nothing
 * keeps a destroyed editor alive through it.
 */
const instances = new WeakMap<HTMLElement, Editor>()

export function publishEditor(element: HTMLElement, editor: Editor): void {
  instances.set(element, editor)
}

/** The editor that owns this element, or null if it is not an editor element. */
export function editorForElement(
  element: Element | null | undefined,
): Editor | null {
  return element instanceof HTMLElement ? (instances.get(element) ?? null) : null
}