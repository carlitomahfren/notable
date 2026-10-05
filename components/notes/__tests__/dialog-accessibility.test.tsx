// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PersonalizeDialog } from "@/components/theme/personalize-dialog"
import { DeleteNoteDialog } from "@/components/notes/delete-note-dialog"
import { makeNote, resetNoteIds } from "@/lib/notes/__tests__/note-factory"

import { click, flush, query, queryAll, render, unmountAll } from "./test-render"

import { clearStorage, renderWithProviders } from "./test-harness"

const navigation = vi.hoisted(() => ({
  pathname: { value: "/notes" },
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname.value,
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

/**
 * jsdom implements neither `showModal` nor `close`, so a dialog never becomes
 * modal here. Stubbing the two platform methods is enough to assert that the
 * components rely on the platform for modality instead of hand-rolling it,
 * which is the property the audit actually cares about.
 */
let showModal: ReturnType<typeof vi.fn>
let close: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetNoteIds()
  clearStorage()

  showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true
  })
  close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event("close"))
  })

  HTMLDialogElement.prototype.showModal = showModal
  HTMLDialogElement.prototype.close = close
})

afterEach(async () => {
  await unmountAll()
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal")
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close")
})

/**
 * Accessible name and description as the platform would compute them.
 *
 * `useId` produces ids containing colons, which are not valid in a CSS
 * selector, so references are resolved by id rather than by query.
 */
function accessibleName(dialog: HTMLElement): {
  name: string
  description: string
} {
  const resolve = (id: string | null): string => {
    if (!id) {
      return ""
    }

    return document.getElementById(id)?.textContent?.trim() ?? ""
  }

  return {
    name: resolve(dialog.getAttribute("aria-labelledby")),
    description: resolve(dialog.getAttribute("aria-describedby")),
  }
}

/** The single dialog the component under test rendered. */
function openDialog(container: HTMLElement): HTMLDialogElement {
  return query<HTMLDialogElement>("dialog", container) as HTMLDialogElement
}

function buttons(container: HTMLElement): HTMLButtonElement[] {
  return queryAll<HTMLButtonElement>("button", container)
}

describe("DeleteNoteDialog", () => {
  async function renderOpen(
    onCancel = vi.fn(),
    onConfirm = vi.fn().mockResolvedValue(undefined),
  ) {
    const container = await render(
      <DeleteNoteDialog
        note={makeNote({ title: "Quarterly plan" })}
        isOpen
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    return { container, onCancel, onConfirm }
  }

  it("opens through showModal so the platform provides modality", async () => {
    const { container } = await renderOpen()

    expect(showModal).toHaveBeenCalledTimes(1)
    expect(openDialog(container).open).toBe(true)
  })

  it("has an accessible name", async () => {
    const { container } = await renderOpen()

    expect(accessibleName(openDialog(container)).name).toBe(
      "Delete note?",
    )
  })

  it("names the note and the consequence in its description", async () => {
    const { container } = await renderOpen()

    const { description } = accessibleName(openDialog(container))

    expect(description).toContain("Quarterly plan")
    expect(description).toContain("permanently removed")
  })

  it("resolves its label and description to real elements", async () => {
    const { container } = await renderOpen()
    const dialog = openDialog(container)

    const labelId = dialog.getAttribute("aria-labelledby") as string
    const bodyId = dialog.getAttribute("aria-describedby") as string

    expect(document.getElementById(labelId)).not.toBeNull()
    expect(document.getElementById(bodyId)).not.toBeNull()
    expect(labelId).not.toBe(bodyId)
  })

  it("cancels on Escape through the platform cancel event", async () => {
    const { onCancel } = await renderOpen()

    query<HTMLDialogElement>("dialog")?.dispatchEvent(
      new Event("cancel", { cancelable: true }),
    )

    await flush()

    expect(onCancel).toHaveBeenCalled()
  })

  it("keeps the first focusable control on Cancel, not Delete", async () => {
    const { container } = await renderOpen()

    const actions = buttons(container)

    expect(actions[0]?.textContent?.trim()).toBe("Cancel")
    expect(actions[1]?.textContent?.trim()).toBe("Delete")
  })

  it("disables both actions and blocks a double submit while deleting", async () => {
    let release: () => void = () => {}
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )

    const { container } = await renderOpen(vi.fn(), onConfirm)

    const confirmButton = buttons(container)[1]

    await click(confirmButton)

    expect(buttons(container).every((button) => button.disabled)).toBe(
      true,
    )
    expect(confirmButton.textContent?.trim()).toBe("Deleting…")

    // A second activation while the first is in flight must not re-delete.
    confirmButton.click()
    await flush()
    expect(onConfirm).toHaveBeenCalledTimes(1)

    release()
    await flush()
  })

  it("recovers its buttons and reports the failure when the delete fails", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("storage is full"))

    const { container } = await renderOpen(vi.fn(), onConfirm)

    await click(buttons(container)[1])
    await flush()

    expect(buttons(container).every((button) => !button.disabled)).toBe(
      true,
    )

    const alert = query('[role="alert"]', container)

    expect(alert?.textContent ?? "").toContain("storage is full")
  })

  it("stays open after a failed delete so the note is not silently lost", async () => {
    const { container } = await renderOpen(
      vi.fn(),
      vi.fn().mockRejectedValue(new Error("storage is full")),
    )

    await click(buttons(container)[1])
    await flush()

    expect(openDialog(container)).not.toBeNull()
    expect(showModal).toHaveBeenCalledTimes(1)
  })

  it("cancels when the pointer lands on the area outside the card", async () => {
    const { container, onCancel } = await renderOpen()

    /*
     * The dialog element is the window around the card, so a click on it is a click
     * outside the content. No listener on the document is involved: the target of the
     * click says so on its own.
     */
    await click(openDialog(container))

    expect(onCancel).toHaveBeenCalled()
  })

  it("stays open for a click anywhere inside the card", async () => {
    const { container, onCancel } = await renderOpen()
    const card = query<HTMLElement>(".confirm-dialog__card", container)

    expect(card).not.toBeNull()

    await click(card as HTMLElement)
    await click(buttons(container)[0] as HTMLButtonElement)

    // Cancel is its own button: it is the click on Cancel that cancels, not a click.
    expect(onCancel).toHaveBeenCalledTimes(1)

    onCancel.mockClear()
    await click(query<HTMLElement>(".confirm-dialog__body", container) as HTMLElement)

    expect(onCancel).not.toHaveBeenCalled()
  })

  it("clears the reported failure when the dialog is cancelled", async () => {
    const { container } = await renderOpen(
      vi.fn(),
      vi.fn().mockRejectedValue(new Error("storage is full")),
    )

    await click(buttons(container)[1])
    await flush()
    expect(query('[role="alert"]', container)).not.toBeNull()

    await click(buttons(container)[0])

    expect(query('[role="alert"]', container)).toBeNull()
  })
})

describe("PersonalizeDialog", () => {
  async function renderOpen(onClose = vi.fn()) {
    const container = await renderWithProviders(
      <PersonalizeDialog isOpen onClose={onClose} />,
    )

    return { container, onClose }
  }

  /*
   * This dialog is mounted on every page, closed, and waits there for the settings
   * button. A closed `<dialog>` is invisible because the platform says so, so the one
   * thing that must never happen is the stylesheet giving it a `display` of its own.
   * The half of that which belongs to the component is here: mounting must not show it,
   * and neither rendering it nor anything about its contents may ask the platform to
   * open it.
   */
  it("is mounted closed and stays closed until it is asked for", async () => {
    const container = await renderWithProviders(
      <PersonalizeDialog isOpen={false} onClose={vi.fn()} />,
    )

    expect(openDialog(container).open).toBe(false)
    expect(openDialog(container).hasAttribute("open")).toBe(false)
    expect(showModal).not.toHaveBeenCalled()
    // The card mounts with the dialog, so a closed one has nothing in it to show.
    expect(query(".personalize-dialog__card", container)).toBeNull()
  })

  it("does not ask the platform to open a closed one when the page mounts it", async () => {
    await renderWithProviders(<PersonalizeDialog isOpen={false} onClose={vi.fn()} />)
    await flush(4)

    expect(showModal).not.toHaveBeenCalled()
  })

  it("opens through showModal so the platform provides modality", async () => {
    const { container } = await renderOpen()

    expect(showModal).toHaveBeenCalledTimes(1)
    expect(openDialog(container).open).toBe(true)
  })

  it("has an accessible name", async () => {
    const { container } = await renderOpen()

    expect(accessibleName(openDialog(container)).name).toBe(
      "Personalize",
    )
  })

  it("leaves no dangling label reference while closed", async () => {
    const container = await renderWithProviders(
      <PersonalizeDialog isOpen={false} onClose={vi.fn()} />,
    )
    const dialog = openDialog(container)

    expect(dialog.hasAttribute("aria-labelledby")).toBe(false)
  })

  it("closes on Escape through the platform cancel event", async () => {
    const { onClose } = await renderOpen()

    query<HTMLDialogElement>("dialog")?.dispatchEvent(
      new Event("cancel", { cancelable: true }),
    )

    await flush()

    expect(onClose).toHaveBeenCalled()
  })

  it("closes when the pointer lands on the area outside the card", async () => {
    const { container, onClose } = await renderOpen()

    await click(openDialog(container))

    expect(onClose).toHaveBeenCalled()
  })

  it("keeps a half-finished set of choices there when the pointer lands inside", async () => {
    const { container, onClose } = await renderOpen()

    /*
     * The point of the dialog is a choice being made in it. A click on the swatch or
     * in the text around it is part of making it, not a dismissal.
     */
    await click(query<HTMLElement>(".personalize-dialog__card", container) as HTMLElement)
    await click(query<HTMLElement>(".personalize-dialog__hint", container) as HTMLElement)

    expect(onClose).not.toHaveBeenCalled()
  })

  it("groups the mode and theme choices in named fieldsets", async () => {
    const { container } = await renderOpen()

    const legends = queryAll("legend", container).map((legend) =>
      legend.textContent?.trim(),
    )

    expect(legends).toEqual(["Color mode", "Theme", "Custom accent"])
  })

  it("exposes each choice as a radio with a group of its own", async () => {
    const { container } = await renderOpen()

    const groups = new Map(
      queryAll<HTMLInputElement>(
        '.personalize-option__radio[type="radio"]',
        container,
      ).map((input) => [input.name, input]),
    )

    expect([...groups.keys()].sort()).toEqual([
      "personalize-color-mode",
      "personalize-preset",
    ])
    expect(queryAll(".personalize-option", container)).toHaveLength(7)
  })

  it("marks exactly one radio per group as checked", async () => {
    const { container } = await renderOpen()

    for (const name of ["personalize-color-mode", "personalize-preset"]) {
      const checked = queryAll<HTMLInputElement>(
        `.personalize-option__radio[name="${name}"]:checked`,
        container,
      )

      expect(checked).toHaveLength(1)
    }
  })

  it("hides decorative swatches from assistive technology", async () => {
    const { container } = await renderOpen()

    const swatches = queryAll(".personalize-option__swatch", container)

    expect(swatches).toHaveLength(4)
    expect(swatches.every((swatch) => swatch.getAttribute("aria-hidden") === "true")).toBe(
      true,
    )
  })

  it("gives the accent colour input an accessible name", async () => {
    const { container } = await renderOpen()

    const input = query<HTMLInputElement>(
      ".personalize-custom__input",
      container,
    ) as HTMLInputElement

    expect(input.type).toBe("color")
    expect(input.getAttribute("aria-label")).toBe("Custom accent color")
  })

  it("disables the reset-to-accent action when no custom accent is set", async () => {
    const { container } = await renderOpen()

    const button = buttons(container).find(
      (candidate) => candidate.textContent?.trim() === "Use theme accent",
    ) as HTMLButtonElement

    expect(button.disabled).toBe(true)
  })

  it("ends the dialog with a primary action", async () => {
    const { container, onClose } = await renderOpen()

    const done = buttons(container).find(
      (candidate) => candidate.textContent?.trim() === "Done",
    ) as HTMLButtonElement

    await click(done)

    expect(onClose).toHaveBeenCalled()
  })
})