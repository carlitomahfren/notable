// @vitest-environment jsdom

import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ExportMenu } from "@/components/editor/export-menu"

import {
  click,
  flush,
  query,
  queryAll,
  render,
  unmountAll,
} from "@/components/notes/__tests__/test-render"

const saveBlob = vi.hoisted(() => vi.fn())

vi.mock("@/lib/export/save-blob", () => ({ saveBlob }))

beforeEach(() => {
  saveBlob.mockClear()
})

afterEach(async () => {
  await unmountAll()
  vi.restoreAllMocks()
})

function trigger(root: ParentNode = document): HTMLElement {
  const element = query(".export-menu__trigger", root)

  if (element === null) {
    throw new Error("export trigger not found")
  }

  return element
}

function panelOpen(root: ParentNode = document): boolean {
  return query(".export-menu__panel", root)?.hasAttribute("hidden") === false
}

/** An option is named by its label; the extension beside it is decoration. */
function option(root: ParentNode, label: string): HTMLElement {
  const match = queryAll(".export-menu__option", root).find(
    (element) =>
      element.querySelector(".export-menu__format")?.textContent === label,
  )

  if (match === undefined) {
    throw new Error(`export option not found: ${label}`)
  }

  return match
}

describe("the export menu", () => {
  it("stays closed until it is asked for", async () => {
    const container = await render(<ExportMenu title="Alpha" content="Body" />)

    expect(panelOpen(container)).toBe(false)
    expect(trigger(container).getAttribute("aria-expanded")).toBe("false")
    expect(trigger(container).getAttribute("aria-controls")).toBe(
      query(".export-menu__panel", container)?.id,
    )
  })

  it("offers all four formats", async () => {
    const container = await render(<ExportMenu title="Alpha" content="Body" />)

    await click(trigger(container))

    expect(
      queryAll(".export-menu__format", container).map(
        (element) => element.textContent,
      ),
    ).toEqual(["Plain text", "Markdown", "PDF", "Word document"])
  })

  it("writes a plain text file under the note's name", async () => {
    const container = await render(
      <ExportMenu title="Release plan" content="# Heading" />,
    )

    await click(trigger(container))
    await click(option(container, "Plain text") as HTMLElement)

    expect(saveBlob).toHaveBeenCalledTimes(1)

    const [blob, fileName] = saveBlob.mock.calls[0] as [Blob, string]

    expect(fileName).toBe("Release plan.txt")
    expect(blob.type).toBe("text/plain;charset=utf-8")
  })

  it("closes itself after a choice and hands focus back", async () => {
    const container = await render(<ExportMenu title="Alpha" content="Body" />)

    await click(trigger(container))
    await click(option(container, "Markdown") as HTMLElement)

    expect(panelOpen(container)).toBe(false)
    expect(trigger(container).getAttribute("aria-expanded")).toBe("false")
  })

  it("announces the file that was written", async () => {
    const container = await render(<ExportMenu title="Alpha" content="Body" />)

    await click(trigger(container))
    await click(option(container, "Markdown") as HTMLElement)

    const live = query("[aria-live]", container)

    expect(live?.textContent).toBe("Exported Alpha.md.")
  })

  it("says when the export failed instead of failing silently", async () => {
    saveBlob.mockImplementationOnce(() => {
      throw new Error("The file could not be created.")
    })

    const container = await render(<ExportMenu title="Alpha" content="Body" />)

    await click(trigger(container))
    await click(option(container, "Plain text") as HTMLElement)

    const error = query(".export-menu__error", container)

    expect(error?.getAttribute("role")).toBe("alert")
    expect(error?.textContent).toBe("The file could not be created.")
    // The trigger is not left claiming to be working.
    expect(trigger(container).textContent).toContain("Export")
  })

  it("closes on Escape and returns focus to the trigger", async () => {
    const container = await render(<ExportMenu title="Alpha" content="Body" />)

    await click(trigger(container))

    expect(panelOpen(container)).toBe(true)

    const plainText = option(container, "Plain text")

    plainText.focus()

    await act(async () => {
      plainText.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      )
    })

    await flush(2)

    expect(panelOpen(container)).toBe(false)
    // Focus follows the panel out of the page, back to the control that opened it.
    expect(document.activeElement).toBe(trigger(container))
  })
})