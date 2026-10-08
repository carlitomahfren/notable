import type { Editor } from "@tiptap/core"
import { act, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"

import { editorForElement } from "@/lib/editor/editor-registry"
import { editorDocumentToMarkdown } from "@/lib/editor/serialize-markdown"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mounted: Root[] = []

/**
 * Minimal React 19 render helper. The project avoids adding a DOM testing
 * library, so this wraps `createRoot` and `act` directly.
 */
export async function render(element: ReactElement): Promise<HTMLElement> {
  const container = document.createElement("div")
  document.body.appendChild(container)

  const root = createRoot(container)
  mounted.push(root)

  await act(async () => {
    root.render(element)
  })

  return container
}

/** Flushes pending promise chains inside `act`. */
export async function flush(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}

export async function unmountAll(): Promise<void> {
  await act(async () => {
    for (const root of mounted.splice(0)) {
      root.unmount()
    }
  })

  document.body.innerHTML = ""
}

export async function click(element: Element): Promise<void> {
  await act(async () => {
    ;(element as HTMLElement).click()
  })

  await flush()
}

export async function type(
  element: HTMLInputElement,
  value: string,
): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set

  await act(async () => {
    setter?.call(element, value)
    element.dispatchEvent(new Event("input", { bubbles: true }))
  })

  await flush()
}

/**
 * Picks an option in a native select the way a pointer or keyboard would:
 * jsdom cannot open the platform menu, so the value is set on the element and
 * a bubbling `change` is dispatched for the handler to observe.
 */
export async function selectValue(
  element: HTMLSelectElement,
  value: string,
): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  )?.set

  await act(async () => {
    setter?.call(element, value)
    element.dispatchEvent(new Event("change", { bubbles: true }))
  })

  await flush()
}

/** The tag filter of the Tags workspace header. */
export function tagFilter(root: ParentNode = document): HTMLSelectElement {
  const select = query<HTMLSelectElement>(".notes-workspace__filter", root)

  if (select === null) {
    throw new Error("tag filter not found (is the Tags workspace open?)")
  }

  return select
}

/** One option of the tag filter, by its value. */
export function tagOption(
  tag: string,
  root: ParentNode = document,
): HTMLOptionElement {
  const filter = tagFilter(root)
  const option = Array.from(filter.options).find(
    (candidate) => candidate.value === tag,
  )

  if (option === undefined) {
    throw new Error(`tag option not found in the filter: ${tag}`)
  }

  return option
}

/** Opens the Tags workspace and picks one tag from its filter. */
export async function selectTag(
  tag: string,
  root: ParentNode = document,
): Promise<void> {
  await click(navButton("Tags", root))
  await selectValue(tagFilter(root), tag)
}

export function queryAll<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector))
}

export function query<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T | null {
  return root.querySelector<T>(selector)
}

export function byLabelText(
  label: string,
  root: ParentNode = document,
): HTMLElement | null {
  const matches = queryAll("button, a", root).filter(
    (element) =>
      element.getAttribute("aria-label") === label ||
      element.textContent?.trim() === label,
  )

  return matches[0] ?? null
}

/**
 * A checkbox by its accessible name. Both forms in use here are covered: a name that
 * comes from a wrapping label, and one that comes from `aria-label`.
 */
export function checkbox(
  label: string,
  root: ParentNode = document,
): HTMLInputElement | null {
  const match = queryAll<HTMLInputElement>(
    'input[type="checkbox"]',
    root,
  ).find(
    (input) =>
      input.closest("label")?.textContent?.trim() === label ||
      input.getAttribute("aria-label") === label,
  )

  return match ?? null
}

/** Note card titles currently rendered in the list. */
export function renderedTitles(root: ParentNode = document): string[] {
  return queryAll<HTMLElement>(".note-card__title", root).map(
    (element) => element.textContent?.trim() ?? "",
  )
}

/**
 * Navigation destinations render an icon plus a label, so they are matched by
 * their visible text rather than by an `aria-label`. Both the desktop bar and the
 * mobile bar are in the tree, so the first match is whichever renders first.
 */
export function navButton(
  label: string,
  root: ParentNode = document,
): HTMLElement {
  const match = queryAll<HTMLElement>(".shell-nav-button, .shell-tags__trigger", root).find(
    (element) =>
      element.querySelector(".shell-nav-button__label, .shell-tags__label")
        ?.textContent?.trim() === label,
  )

  if (match === undefined) {
    throw new Error(`navigation destination not found: ${label}`)
  }

  return match
}

/**
 * The live editor behind a rendered note body.
 *
 * A rich text editor is a `contenteditable` region, and jsdom does not type into one:
 * it has no layout, no selection model, and no way to turn a keystroke into the
 * transaction the editor would have made. So tests drive the editor the way the
 * toolbar and the shortcuts do, through the same commands the UI runs, and read the
 * result back out of its document.
 *
 * That is a real trade. It proves the wiring, not the browser's typing, which is what
 * the manual pass in a browser is for.
 */
export function proseElement(root: ParentNode = document): HTMLElement {
  const prose = query<HTMLElement>(".rich-text__prose", root)

  if (prose === null) {
    throw new Error("note editor body not found")
  }

  return prose
}

export function editorFor(root: ParentNode = document): Editor {
  const editor = editorForElement(proseElement(root))

  if (editor === null) {
    throw new Error("note editor instance not found for the rendered body")
  }

  return editor
}

/** The Markdown this editor would save right now. */
export function editorMarkdown(root: ParentNode = document): string {
  return editorDocumentToMarkdown(editorFor(root).getJSON())
}

/** Types into the note body the way the toolbar applies a mark: at the caret. */
export async function typeInNote(
  value: string,
  root: ParentNode = document,
): Promise<void> {
  const editor = editorFor(root)

  await act(async () => {
    editor.commands.insertContent(value)
  })

  await flush()
}

/** Selects the note's whole first paragraph, for "wrap this in bold" tests. */
export async function selectFirstParagraph(
  root: ParentNode = document,
): Promise<void> {
  const editor = editorFor(root)
  const paragraph = editor.state.doc.firstChild
  /* A node's size counts the tokens around its text, so the text runs two shorter. */
  const end = 1 + (paragraph?.nodeSize ?? 2) - 2

  await act(async () => {
    editor.commands.setTextSelection({ from: 1, to: end })
  })

  await flush()
}

/** Empties the note body the way selecting everything and deleting would. */
export async function clearNote(root: ParentNode = document): Promise<void> {
  const editor = editorFor(root)

  await act(async () => {
    editor.commands.clearContent(true)
  })

  await flush()
}