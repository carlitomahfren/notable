// @vitest-environment jsdom

import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/providers/theme-provider"
import { PersonalizeDialog } from "@/components/theme/personalize-dialog"
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-config"
import {
  click,
  query,
  queryAll,
  render,
  type,
  unmountAll,
} from "@/components/notes/__tests__/test-render"

function stored(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(THEME_STORAGE_KEY) ?? "null") ?? {}
}

async function renderDialog(isOpen: boolean) {
  const onClose = vi.fn()

  const container = await render(
    <ThemeProvider>
      <PersonalizeDialog isOpen={isOpen} onClose={onClose} />
    </ThemeProvider>,
  )

  return { container, onClose, dialog: query<HTMLDialogElement>("dialog", container) as HTMLDialogElement }
}

function dialogs(): HTMLDialogElement[] {
  return queryAll<HTMLDialogElement>("dialog")
}

function modeInputs(container: HTMLElement): HTMLInputElement[] {
  return queryAll<HTMLInputElement>('input[name="personalize-color-mode"]', container)
}

function presetInputs(container: HTMLElement): HTMLInputElement[] {
  return queryAll<HTMLInputElement>('input[name="personalize-preset"]', container)
}

function colorInput(container: HTMLElement): HTMLInputElement {
  const input = query<HTMLInputElement>('input[type="color"]', container)

  if (input === null) {
    throw new Error("accent input not found")
  }

  return input
}

function buttonNamed(container: HTMLElement, name: string): HTMLElement {
  const match = queryAll<HTMLElement>("button", container).find(
    (button) => button.textContent?.trim() === name,
  )

  if (match === undefined) {
    throw new Error(`button not found: ${name}`)
  }

  return match
}

beforeEach(() => {
  window.localStorage.clear()

  document.documentElement.removeAttribute("data-color-scheme")
  document.documentElement.removeAttribute("data-preset")
  document.documentElement.removeAttribute("style")
})

afterEach(async () => {
  await unmountAll()

  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe("structure", () => {
  it("renders an empty dialog while closed", async () => {
    const { dialog } = await renderDialog(false)

    expect(dialog).not.toBeNull()
    expect(dialog.textContent?.trim()).toBe("")
    expect(dialog.getAttribute("aria-labelledby")).toBeNull()
  })

  it("labels the dialog once open", async () => {
    const { container, dialog } = await renderDialog(true)

    const labelledBy = dialog.getAttribute("aria-labelledby")

    expect(labelledBy).not.toBeNull()
    expect(query(`#${labelledBy as string}`, container)?.textContent).toBe(
      "Personalize",
    )
  })

  it("groups the controls with legends rather than headings", async () => {
    const { container } = await renderDialog(true)

    expect(
      queryAll<HTMLElement>("fieldset", container).map(
        (field) => query("legend", field)?.textContent,
      ),
    ).toEqual(["Color mode", "Theme", "Custom accent"])
  })

  it("offers exactly the approved modes and presets", async () => {
    const { container } = await renderDialog(true)

    expect(modeInputs(container).map((input) => input.value)).toEqual([
      "system",
      "light",
      "dark",
    ])
    expect(presetInputs(container).map((input) => input.value)).toEqual([
      "default",
      "paper",
      "forest",
      "lavender",
    ])
  })

  it("gives every preset a non-color name alongside its swatch", async () => {
    const { container } = await renderDialog(true)

    const names = queryAll<HTMLElement>(
      ".personalize-option__name",
      container,
    ).map((element) => element.textContent)

    expect(names).toEqual([
      "System",
      "Light",
      "Dark",
      "Default",
      "Paper",
      "Forest",
      "Lavender",
    ])
  })

  it("keeps the native radios in the accessibility tree", async () => {
    const { container } = await renderDialog(true)

    for (const input of [...modeInputs(container), ...presetInputs(container)]) {
      expect(input.type).toBe("radio")
      expect(input.closest("label")).not.toBeNull()
    }
  })
})

describe("current preferences", () => {
  it("checks the stored mode and preset", async () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "dark", preset: "forest", accent: null }),
    )

    const { container } = await renderDialog(true)

    expect(
      modeInputs(container).find((input) => input.checked)?.value,
    ).toBe("dark")
    expect(
      presetInputs(container).find((input) => input.checked)?.value,
    ).toBe("forest")
  })

  it("shows the active preset accent when no custom accent is set", async () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "light", preset: "paper", accent: null }),
    )

    const { container } = await renderDialog(true)

    expect(colorInput(container).value).toBe("#a4601f")
  })

  it("shows a stored custom accent", async () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorMode: "light", preset: "paper", accent: "#ff00aa" }),
    )

    const { container } = await renderDialog(true)

    expect(colorInput(container).value).toBe("#ff00aa")
  })

  it("disables the restore control only when the preset accent is in use", async () => {
    const { container } = await renderDialog(true)

    const restore = buttonNamed(container, "Use theme accent") as HTMLButtonElement

    expect(restore.disabled).toBe(true)

    await type(colorInput(container), "#123456")

    expect(
      (buttonNamed(container, "Use theme accent") as HTMLButtonElement).disabled,
    ).toBe(false)
  })
})

describe("changing the theme from the dialog", () => {
  it("persists a new color mode", async () => {
    const { container } = await renderDialog(true)

    await click(modeInputs(container)[2])

    expect(stored()).toMatchObject({ colorMode: "dark" })
    expect(document.documentElement.getAttribute("data-color-scheme")).toBe(
      "dark",
    )
  })

  it("persists a new preset", async () => {
    const { container } = await renderDialog(true)

    await click(presetInputs(container)[2])

    expect(stored()).toMatchObject({ preset: "forest" })
    expect(document.documentElement.getAttribute("data-preset")).toBe("forest")
  })

  it("persists a custom accent while the picker moves", async () => {
    const { container } = await renderDialog(true)

    await type(colorInput(container), "#00ff88")

    expect(stored()).toMatchObject({ accent: "#00ff88" })
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      "#00ff88",
    )
  })

  it("restores the preset accent on request", async () => {
    const { container } = await renderDialog(true)

    await type(colorInput(container), "#00ff88")
    await click(buttonNamed(container, "Use theme accent"))

    expect(stored()).toMatchObject({ accent: null })
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("")
    expect(colorInput(container).value).toBe("#3b5bdb")
  })

  it("resets every preference from the dialog", async () => {
    const { container } = await renderDialog(true)

    await click(modeInputs(container)[2])
    await click(presetInputs(container)[1])
    await type(colorInput(container), "#00ff88")
    await click(buttonNamed(container, "Reset to default"))

    expect(stored()).toEqual({
      colorMode: "system",
      preset: "default",
      accent: null,
    })
    expect(
      modeInputs(container).find((input) => input.checked)?.value,
    ).toBe("system")
    expect(
      presetInputs(container).find((input) => input.checked)?.value,
    ).toBe("default")
  })
})

describe("dismissal", () => {
  it("closes when Done is pressed", async () => {
    const { container, onClose } = await renderDialog(true)

    await click(buttonNamed(container, "Done"))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("closes when the platform reports Escape", async () => {
    const { dialog, onClose } = await renderDialog(true)

    await act(async () => {
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("closes when the dialog is closed by the platform", async () => {
    const { dialog, onClose } = await renderDialog(true)

    await act(async () => {
      dialog.dispatchEvent(new Event("close"))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe("storage failures", () => {
  it("warns accessibly when the theme cannot be saved", async () => {
    const { container } = await renderDialog(true)

    expect(query('[role="alert"]', container)).toBeNull()

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded")
    })

    await click(presetInputs(container)[2])

    const alert = query('[role="alert"]', container)

    expect(alert).not.toBeNull()
    expect(alert?.textContent).toContain("could not be saved")
  })
})

describe("dialog isolation", () => {
  it("is never nested inside another dialog", async () => {
    const { dialog } = await renderDialog(true)

    // `closest` would match the element itself, so ancestors are walked directly.
    let ancestor = dialog.parentElement

    while (ancestor !== null) {
      expect(ancestor.tagName).not.toBe("DIALOG")
      ancestor = ancestor.parentElement
    }
  })

  it("renders a single dialog for the settings entry", async () => {
    await renderDialog(true)

    expect(dialogs()).toHaveLength(1)
  })
})