// @vitest-environment jsdom

import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotesShell } from "@/components/shell/notes-shell"
import { makeNote } from "@/lib/notes/__tests__/note-factory"

import {
  clearStorage,
  renderWithProviders,
  seedStorage,
} from "@/components/notes/__tests__/test-harness"
import {
  click,
  query,
  queryAll,
  renderedTitles,
  type,
  unmountAll,
} from "@/components/notes/__tests__/test-render"

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

function searchBar(): HTMLElement {
  const bar = query(".shell-search", document)

  if (bar === null) {
    throw new Error("search not found")
  }

  return bar
}

function searchToggle(): HTMLButtonElement {
  const toggle = query<HTMLButtonElement>(".shell-search__toggle", document)

  if (toggle === null) {
    throw new Error("search toggle not found")
  }

  return toggle
}

function searchField(): HTMLInputElement {
  const field = query<HTMLInputElement>(".shell-search__input", document)

  if (field === null) {
    throw new Error("search field not found")
  }

  return field
}

function searchClose(): HTMLElement {
  const close = query(".shell-search__close", document)

  if (close === null) {
    throw new Error("search close button not found")
  }

  return close
}

async function pressEscapeFromField() {
  const field = searchField()

  field.focus()

  await act(async () => {
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    )
  })
}

async function pressShortcut(init: KeyboardEventInit) {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ...init }))
  })
}

beforeEach(async () => {
  clearStorage()
  navigation.pathname.value = "/notes"
  await seedStorage([
    makeNote({ title: "Alpha", tags: ["work"] }),
    makeNote({ title: "Beta", tags: ["home"] }),
  ])
})

afterEach(async () => {
  await unmountAll()

  clearStorage()
})

describe("expandable search", () => {
  it("starts collapsed so it costs no room until it is wanted", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(searchBar().dataset.open).toBe("false")
    expect(searchToggle().getAttribute("aria-expanded")).toBe("false")
    expect(
      query(".shell-search__field", document)?.hasAttribute("hidden"),
    ).toBe(true)
  })

  it("keeps the collapsed field out of the accessibility tree", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    /*
     * `hidden` on the wrapper rather than a zero-width field, so the input is
     * gone from the tab order and the accessibility tree rather than just
     * invisible.
     */
    const wrapper = query(".shell-search__field", document)

    expect(wrapper?.hasAttribute("hidden")).toBe(true)
    expect(searchToggle().getAttribute("aria-expanded")).toBe("false")
  })

  it("opens from the toggle and moves focus into the field", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())

    expect(searchBar().dataset.open).toBe("true")
    expect(searchToggle().getAttribute("aria-expanded")).toBe("true")
    expect(document.activeElement).toBe(searchField())
  })

  it("filters the visible notes as the query is typed", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())
    await type(searchField(), "alp")

    expect(renderedTitles()).toEqual(["Alpha"])
  })

  it("announces how many notes matched", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())
    await type(searchField(), "alp")

    expect(
      query('[role="status"]', document)?.textContent?.trim(),
    ).toBe("1 note match your search.")
  })

  it("keeps the query after closing, so reopening is not a fresh start", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())
    await type(searchField(), "alp")
    await click(searchClose())

    expect(query(".shell-search__field", document)?.hasAttribute("hidden")).toBe(
      true,
    )
    expect(renderedTitles()).toEqual(["Alpha"])

    await click(searchToggle())

    expect(searchField().value).toBe("alp")
    expect(renderedTitles()).toEqual(["Alpha"])
  })

  /*
   * The collapsed field is only a hint of pixels wide, so a retained query would
   * otherwise leave the list silently filtered with no visible explanation.
   */
  it("marks the collapsed toggle as holding an active filter", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(searchToggle().hasAttribute("data-has-query")).toBe(false)

    await click(searchToggle())
    await type(searchField(), "alp")
    await click(searchClose())

    expect(searchToggle().hasAttribute("data-has-query")).toBe(true)
    expect(searchToggle().getAttribute("aria-label")).toBe(
      "Search notes, a filter is active",
    )
  })

  it("drops the indicator once the query is cleared", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())
    await type(searchField(), "alp")
    await click(searchClose())
    await click(searchToggle())
    await type(searchField(), "")

    expect(searchToggle().hasAttribute("data-has-query")).toBe(false)
  })

  /*
   * Escape has to be reversible. Closing first would throw away the typed query
   * with no way back to it, so the first press clears and only the next closes.
   */
  it("clears the query on the first Escape and closes on the second", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())
    await type(searchField(), "alp")

    await pressEscapeFromField()

    expect(searchField().value).toBe("")
    expect(searchBar().dataset.open).toBe("true")
    expect(renderedTitles()).toEqual(["Alpha", "Beta"])

    await pressEscapeFromField()

    expect(searchBar().dataset.open).toBe("false")
  })

  it("closes in one press when there is nothing to clear", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())
    await pressEscapeFromField()

    expect(searchBar().dataset.open).toBe("false")
  })

  it("returns focus to the toggle after Escape", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())
    await pressEscapeFromField()

    expect(document.activeElement).toBe(searchToggle())
  })

  it("returns focus to the toggle after the close button", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())
    await click(searchClose())

    expect(document.activeElement).toBe(searchToggle())
  })

  it("opens with the keyboard shortcut from anywhere", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await pressShortcut({ ctrlKey: true })

    expect(searchBar().dataset.open).toBe("true")
    expect(document.activeElement).toBe(searchField())
  })

  it("accepts the command key spelling on Apple hardware", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await pressShortcut({ metaKey: true })

    expect(searchBar().dataset.open).toBe("true")
  })

  /*
   * The shortcut means "take me to search", so pressing it again re-seats the
   * caret rather than dismissing the field. Treating it as a toggle would make
   * the key feel broken.
   */
  it("re-focuses the field when pressed again instead of closing", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await pressShortcut({ metaKey: true })
    await pressShortcut({ metaKey: true })

    expect(searchBar().dataset.open).toBe("true")
    expect(document.activeElement).toBe(searchField())
  })

  it("ignores the shortcut when no modifier is held", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }))
    })

    expect(searchBar().dataset.open).toBe("false")
  })

  it("does nothing on an unrelated shortcut", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", metaKey: true }))
    })

    expect(searchBar().dataset.open).toBe("false")
  })

  it("stays open when Tags is opened, since Tags is a destination like the rest", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())
    await type(searchField(), "alp")

    expect(searchBar().dataset.open).toBe("true")

    await click(query(".shell-tags__trigger", document) as HTMLElement)

    expect(searchBar().dataset.open).toBe("true")
    expect(searchField().value).toBe("alp")
  })

  it("keeps a single set of controls mounted so the bars cannot disagree", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(queryAll(".shell-search", document)).toHaveLength(1)
  })

  it("leaves the field alone when a note is created from the bar", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(searchToggle())
    await type(searchField(), "alp")

    await click(
      queryAll<HTMLElement>('.shell-new-note[data-variant="bar"]', container)[0],
    )

    /*
     * Creating a note is not a navigation intent, so it must not silently reset a
     * filter the user is still relying on. The collapsed indicator and the result
     * count are how they see and undo it.
     */
    expect(searchBar().dataset.open).toBe("true")
    expect(searchField().value).toBe("alp")
    expect(renderedTitles()).toEqual(["Alpha"])
  })
})

/*
 * One magnifying glass, at every moment.
 *
 * The collapsed button and the expanded field each carry their own icon, so showing
 * both puts two identical glyphs side by side inside the same control. That reads as
 * a rendering fault rather than as a control, and on a narrow bar it is also the
 * thing most likely to crowd the query text.
 */
describe("search icon placement", () => {
  function magnifiers(): Element[] {
    return queryAll(
      ".shell-search__toggle-icon, .shell-search__field-icon",
      document,
    ).filter((icon) => icon.closest("[hidden]") === null)
  }

  it("shows a single icon while collapsed", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(magnifiers()).toHaveLength(1)
  })

  it("shows a single icon while expanded", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)
    await click(searchToggle())

    expect(magnifiers()).toHaveLength(1)
    expect(query(".shell-search__field-icon", document)).not.toBeNull()
  })

  it("hides the standalone toggle the moment the field appears", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(searchToggle().hidden).toBe(false)

    await click(searchToggle())

    expect(searchToggle().hidden).toBe(true)
  })

  it("keeps the hidden toggle out of the accessibility tree while expanded", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)
    await click(searchToggle())

    expect(searchToggle().offsetParent).toBeNull()
  })

  it("brings the toggle back on close, keeping one icon again", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)
    await click(searchToggle())
    await click(searchClose())

    expect(searchToggle().hidden).toBe(false)
    expect(magnifiers()).toHaveLength(1)
  })

  it("still exposes the collapsed toggle as the focus target after closing", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)
    await click(searchToggle())
    await click(searchClose())

    /*
     * The button is hidden during the close commit, so focus has to wait for the
     * following effect. Without the handoff, keyboard users would be stranded at the
     * top of the document every time they dismissed search.
     */
    expect(document.activeElement).toBe(searchToggle())
  })

  it("declares the field as what the toggle controls", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const controls = searchToggle().getAttribute("aria-controls")

    expect(controls).toBe(searchField().id)
  })
})