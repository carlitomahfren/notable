// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DeleteNoteButton } from "@/components/editor/delete-note-button"

import { click, query, queryAll, render, unmountAll } from "@/components/notes/__tests__/test-render"

/**
 * The control is an icon, so its name exists only in the accessibility tree and in a
 * tooltip. These tests pin both, because a destructive action with no discoverable
 * name is a destructive action nobody can find and nobody can describe.
 */
describe("delete note button", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await unmountAll()
  })

  async function renderButton() {
    const onClick = vi.fn()

    const container = await render(<DeleteNoteButton onClick={onClick} />)

    const button = query<HTMLButtonElement>(".editor-delete", container)

    if (button === null) {
      throw new Error("delete button not rendered")
    }

    return { button, onClick, container }
  }

  it("is named for a screen reader, not by its icon", async () => {
    const { button } = await renderButton()

    expect(button.getAttribute("aria-label")).toBe("Delete note")
    expect(button.textContent).toBe("")
  })

  it("repeats the name as a tooltip for pointer users", async () => {
    const { button } = await renderButton()

    expect(button.getAttribute("title")).toBe("Delete note")
  })

  it("hides the glyph from assistive technology", async () => {
    const { button } = await renderButton()

    const icon = query(".editor-delete__icon", button)

    expect(icon).not.toBeNull()
    expect(icon?.getAttribute("aria-hidden")).toBe("true")
  })

  it("is a plain button, so it activates on Enter and Space", async () => {
    const { button, onClick } = await renderButton()

    expect(button.getAttribute("type")).toBe("button")
    expect(button.tagName).toBe("BUTTON")

    await click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("carries no name of its own beyond the one it is given", async () => {
    const { button } = await renderButton()

    // One name, stated twice for two different audiences, never a third variant.
    const names = [
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
    ].filter((name) => name !== null)

    expect(new Set(names).size).toBe(1)
    expect(queryAll("[aria-labelledby]", button)).toHaveLength(0)
  })
})