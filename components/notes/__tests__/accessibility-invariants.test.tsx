// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NoteEditor } from "@/components/editor/note-editor"
import { NotesShell } from "@/components/shell/notes-shell"
import { makeNote, resetNoteIds } from "@/lib/notes/__tests__/note-factory"

import { byLabelText, click, query, queryAll, selectTag, selectValue, tagFilter, unmountAll } from "./test-render"

import { clearStorage, renderWithProviders, seedStorage } from "./test-harness"

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

beforeEach(() => {
  clearStorage()
  resetNoteIds()
  navigation.pathname.value = "/notes"
  navigation.router.push.mockClear()
})

afterEach(async () => {
  await unmountAll()
})

function note() {
  return makeNote({
    title: "Alpha",
    content: "# Heading\n\nSome body text.",
    tags: ["work"],
  })
}

async function renderEditor() {
  const target = note()

  await seedStorage([target])

  return renderWithProviders(
    <NotesShell>
      <NoteEditor note={target} deleteControl={<button type="button">Delete</button>} />
    </NotesShell>,
  )
}

describe("landmarks and headings", () => {
  it("exposes exactly one main landmark as the skip link target", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const main = queryAll("main", container)

    expect(main).toHaveLength(1)
    expect(main[0].id).toBe("shell-main")
  })

  it("makes the skip link target programmatically focusable", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const skipLink = query<HTMLAnchorElement>(".shell-skip-link", container)
    const main = query("main", container)

    expect(skipLink?.getAttribute("href")).toBe("#shell-main")
    /*
     * Without tabIndex the browser only scrolls to the target and focus stays
     * behind it, so the skip link does nothing useful for a keyboard user.
     */
    expect(main?.getAttribute("tabindex")).toBe("-1")

    main?.focus()

    expect(document.activeElement).toBe(main)
  })

  it("labels the note list region", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const region = query('section[aria-label="Note list"]', container)

    expect(region).not.toBeNull()
  })

  it("gives the two navigation bars distinct landmark names", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    /*
     * Both bars are mounted and CSS picks one. Two identically named navigation
     * landmarks would be ambiguous the moment both were exposed, so the desktop
     * bar keeps the descriptive name and the bottom bar uses the conventional
     * name for a tab bar.
     */
    expect(query('nav[aria-label="Notes navigation"]', container)).not.toBeNull()
    expect(query('nav[aria-label="Primary"]', container)).not.toBeNull()
  })

  it("gives the settings entry an accessible name in both bars", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(query('button[aria-label="Settings"]', container)).not.toBeNull()
    expect(
      queryAll<HTMLElement>(".shell-nav-button__label", container).some(
        (label) => label.textContent?.trim() === "Settings",
      ),
    ).toBe(true)
  })

  it("keeps a single h1 on the editor screen", async () => {
    const container = await renderEditor()

    expect(queryAll("h1", container)).toHaveLength(1)
  })

  it("never lets note markdown create a competing h1", async () => {
    const container = await renderEditor()

    await click(query('[role="tab"]:last-of-type', container) as HTMLElement)

    expect(queryAll("h1", container)).toHaveLength(1)
  })
})

describe("keyboard reachability", () => {
  it("makes the rendered preview reachable by keyboard so it can be scrolled", async () => {
    const container = await renderEditor()

    await click(query('[role="tab"]:last-of-type', container) as HTMLElement)

    const panel = query('[role="tabpanel"][id$="-panel-preview"]', container)

    /*
     * The preview contains no focusable content, so without tabIndex a long note
     * could only be scrolled with a pointer.
     */
    expect(panel?.getAttribute("tabindex")).toBe("0")

    panel?.focus()

    expect(document.activeElement).toBe(panel)
  })

  it("keeps one tab stop for the mode tablist via a roving tabindex", async () => {
    const container = await renderEditor()

    const tabs = queryAll('[role="tab"]', container)

    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
    ])
    expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["0", "-1"])
  })

  it("links the selected tab to the panel it owns", async () => {
    const container = await renderEditor()

    /*
     * There is one panel and the tab decides what it is: Edit and Preview show the same
     * document, so there is nothing to have two panels for. Every tab still says which
     * panel it shows, and the one that is showing owns the panel that is on screen.
     */
    for (const tab of queryAll('[role="tab"]', container)) {
      expect(tab.getAttribute("aria-controls")).not.toBeNull()
    }

    const selected = queryAll('[role="tab"][aria-selected="true"]', container)

    expect(selected).toHaveLength(1)

    const panels = queryAll('[role="tabpanel"]', container)

    expect(panels).toHaveLength(1)

    const panel = panels[0]

    expect(panel.id).toBe(selected[0].getAttribute("aria-controls"))
    expect(panel.getAttribute("aria-labelledby")).toBe(selected[0].id)
  })

  it("swaps which panel the single panel is when the tab changes", async () => {
    const container = await renderEditor()

    const [edit, preview] = queryAll('[role="tab"]', container)

    await click(preview)

    const panel = query('[role="tabpanel"]', container) as HTMLElement

    expect(panel.id).toBe(preview.getAttribute("aria-controls"))
    expect(panel.getAttribute("aria-labelledby")).toBe(preview.id)
    expect(panel.getAttribute("aria-labelledby")).not.toBe(edit.id)
  })

  it("names every icon-only control", async () => {
    const container = await renderEditor()

    const unnamed = queryAll("button", container).filter((button) => {
      const label = button.getAttribute("aria-label")
      const text = button.textContent?.trim() ?? ""
      const title = button.getAttribute("title")

      return label === null && text === "" && title === null
    })

    expect(unnamed).toEqual([])
  })

  /*
   * Tags is a workspace destination now, not a disclosure: the trigger changes
   * the view in the same single step as All Notes, and there is no panel left
   * to trap focus in or dismiss with Escape.
   */
  it("keeps the Tags trigger clear of disclosure semantics", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const trigger = query(".shell-tags__trigger", container)

    expect(trigger?.getAttribute("aria-expanded")).toBeNull()
    expect(trigger?.getAttribute("aria-controls")).toBeNull()
    expect(query(".shell-tags__panel", container)).toBeNull()
  })

  /*
   * The workspace filter is what replaced the panel's list of tags. It is a
   * native select, so the platform owns the menu and the only remaining
   * obligation is that the close at the header has an accessible name.
   */
  it("names the tag filter for assistive technology", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await selectTag("work")

    const filter = tagFilter(container)
    const label = filter.labels?.[0]

    expect(label?.textContent?.trim()).toBe("Filter notes by tag")
    expect(label?.getAttribute("for")).toBe(filter.id)
  })

  it("marks the trigger current for the whole workspace, tag or not", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await selectTag("work")

    const [, mobile] = queryAll(".shell-tags__trigger", container)

    expect(mobile.getAttribute("aria-current")).toBe("true")

    await selectValue(tagFilter(container), "")

    expect(mobile.getAttribute("aria-current")).toBe("true")
  })

  it("hides the collapsed search field from the tab order", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const field = query(".shell-search__field", container)

    expect(field?.hasAttribute("hidden")).toBe(true)

    await click(byLabelText("Search notes", container) as HTMLElement)

    expect(query(".shell-search__field", container)?.hasAttribute("hidden")).toBe(
      false,
    )
  })
})

describe("note card controls", () => {
  async function renderList() {
    await seedStorage([note(), makeNote({ title: "Beta" })])

    return renderWithProviders(<NotesShell>{null}</NotesShell>)
  }

  /*
   * The card is a link. A tick or a delete nested inside it would be activated by a
   * click aimed for it, and the note would open on the way to being deleted.
   */
  it("keeps the tick and the actions out of the card link", async () => {
    const container = await renderList()

    for (const card of queryAll("a.note-card", container)) {
      expect(queryAll("button, input, a", card)).toEqual([])
    }
  })

  it("names every control a card carries", async () => {
    const container = await renderList()

    const unnamed = queryAll(
      ".note-card__item input, .note-card__item button",
      container,
    ).filter((control) => {
      const label = control.getAttribute("aria-label")
      const text = control.textContent?.trim() ?? ""
      const wrapping = control.closest("label")?.textContent?.trim() ?? ""

      return label === null && text === "" && wrapping === ""
    })

    expect(unnamed).toEqual([])
  })

  it("gives every card's tick a name of its own", async () => {
    const container = await renderList()

    const names = queryAll<HTMLInputElement>(
      ".note-card__select-input",
      container,
    ).map((input) => input.closest("label")?.textContent?.trim() ?? "")

    expect(names).toEqual(["Select Alpha", "Select Beta"])
  })

  it("offers the same three ways back into the list on every card", async () => {
    const container = await renderList()

    for (const item of queryAll(".note-card__item", container)) {
      // The link, the tick, pin, and delete.
      expect(queryAll("a, input, button", item)).toHaveLength(4)
    }
  })
})

describe("live regions", () => {
  it("announces the loading state politely", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const status = query('[role="status"]', container)

    expect(status).not.toBeNull()
  })

  it("keeps the search result count reachable while searching", async () => {
    const container = await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const input = query<HTMLInputElement>('input[type="search"]', container)

    expect(input).not.toBeNull()
    expect(
      query('[role="status"]', container),
    ).not.toBeNull()
  })

  it("does not wrap every visible label in a live region", async () => {
    const container = await renderEditor()

    /*
     * Over-announcing is a real failure mode: the save indicator already shows
     * its state as text, so only settled states need announcing.
     *
     * Three regions are allowed and each has earned it: the settled save state, the
     * search result count, and the name of a file that has just been written, which
     * is otherwise an event the page cannot report at all.
     */
    const liveRegions = queryAll('[aria-live], [role="status"], [role="alert"]', container)

    expect(liveRegions.length).toBeLessThanOrEqual(3)

    // The export announcement is silent until there is something to announce.
    expect(
      liveRegions.filter((region) => region.textContent?.trim() !== "").length,
    ).toBeLessThanOrEqual(2)
  })
})