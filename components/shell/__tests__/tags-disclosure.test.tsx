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

/** The desktop bar comes first in the document; the mobile copy follows. */
function triggers(): HTMLButtonElement[] {
  return queryAll<HTMLButtonElement>(".shell-tags__trigger", document)
}

function panels(): HTMLElement[] {
  return queryAll<HTMLElement>(".shell-tags__panel", document)
}

function tagOption(tag: string, root: ParentNode = document): HTMLElement {
  const match = queryAll<HTMLElement>(".shell-tags__option", root).find(
    (element) =>
      element.querySelector(".shell-tags__name")?.textContent?.trim() === tag,
  )

  if (match === undefined) {
    throw new Error(`tag option not found: ${tag}`)
  }

  return match
}

async function pressEscape(element: HTMLElement) {
  element.focus()

  await act(async () => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    )
  })
}

beforeEach(async () => {
  clearStorage()
  navigation.pathname.value = "/notes"
  await seedStorage([
    makeNote({ title: "Alpha", tags: ["work"] }),
    makeNote({ title: "Beta", tags: ["home"] }),
    makeNote({ title: "Gamma", tags: ["work", "home"] }),
  ])
})

afterEach(async () => {
  await unmountAll()

  clearStorage()
})

describe("tags disclosure", () => {
  it("keeps the panel closed until it is asked for", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(triggers()[0].getAttribute("aria-expanded")).toBe("false")
    expect(panels()[0].hasAttribute("hidden")).toBe(true)
  })

  it("opens on the trigger", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])

    expect(triggers()[0].getAttribute("aria-expanded")).toBe("true")
    expect(panels()[0].hasAttribute("hidden")).toBe(false)
  })

  it("opens both copies together because they share one piece of state", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])

    /*
     * Only one bar is ever on screen, but both copies must agree, otherwise the
     * panel the CSS reveals would open empty.
     */
    expect(triggers()).toHaveLength(2)
    expect(panels().every((panel) => panel.hasAttribute("hidden") === false)).toBe(
      true,
    )
  })

  it("points the trigger at the panel it owns", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const trigger = triggers()[0]

    await click(trigger)

    expect(trigger.getAttribute("aria-controls")).toBe(panels()[0].id)
  })

  it("switches the list to the chosen tag", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])
    await click(tagOption("work"))

    expect(renderedTitles()).toEqual(["Alpha", "Gamma"])
  })

  it("closes after a tag is chosen, since the choice is now visible in the list", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])
    await click(tagOption("work"))

    expect(panels()[0].hasAttribute("hidden")).toBe(true)
  })

  it("shows how many notes each tag holds", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])

    expect(
      query(".shell-tags__count", tagOption("work"))?.textContent?.trim(),
    ).toBe("2")
    expect(
      query(".shell-tags__count", tagOption("home"))?.textContent?.trim(),
    ).toBe("2")
  })

  it("spells the count out for assistive technology", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])

    // The visible count is decorative so the two are never read out together.
    expect(
      query(".shell-tags__count", tagOption("work"))?.getAttribute("aria-hidden"),
    ).toBe("true")
    expect(tagOption("work").textContent).toContain(", 2 notes")
  })

  it("marks the selected tag as the current destination", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])
    await click(tagOption("work"))

    expect(triggers()[0].getAttribute("aria-current")).toBe("true")

    await click(triggers()[0])

    expect(tagOption("work").getAttribute("aria-current")).toBe("true")
    expect(tagOption("home").getAttribute("aria-current")).toBeNull()
  })

  it("is a selector rather than a toggle, so re-choosing a tag changes nothing", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])
    await click(tagOption("work"))
    await click(triggers()[0])
    await click(tagOption("work"))

    expect(renderedTitles()).toEqual(["Alpha", "Gamma"])
  })

  it("leaves the tag view through a real destination rather than deselecting", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])
    await click(tagOption("work"))

    await click(
      queryAll<HTMLElement>('.shell-nav-button', document).find(
        (element) =>
          element.querySelector(".shell-nav-button__label")?.textContent?.trim() ===
          "All Notes",
      ) as HTMLElement,
    )

    expect(renderedTitles()).toEqual(["Alpha", "Beta", "Gamma"])
    expect(triggers()[0].hasAttribute("aria-current")).toBe(false)
  })

  it("says so when there is nothing to show", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])

    expect(query(".shell-tags__empty", panels()[0])?.textContent).toBe(
      "No tags yet",
    )
    expect(queryAll(".shell-tags__option", panels()[0])).toHaveLength(0)
  })

  it("closes on Escape and hands focus back", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])
    await pressEscape(triggers()[0])

    expect(panels()[0].hasAttribute("hidden")).toBe(true)
    expect(document.activeElement).toBe(triggers()[0])
  })

  it("closes on Escape from inside the panel too", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])
    await pressEscape(tagOption("work"))

    expect(panels()[0].hasAttribute("hidden")).toBe(true)
    expect(document.activeElement).toBe(triggers()[0])
  })

  /*
   * Both bars keep a copy mounted, so a document-level Escape handler would let
   * the copy that happened to register last pull focus to a trigger the user
   * cannot see.
   */
  it("returns focus to the copy the user pressed, not the hidden one", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const [, mobile] = triggers()

    await click(mobile)
    await pressEscape(mobile)

    expect(document.activeElement).toBe(mobile)
  })

  it("closes when a pointer lands outside it", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])

    await act(async () => {
      document
        .querySelector("main")
        ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    })

    expect(panels()[0].hasAttribute("hidden")).toBe(true)
  })

  it("stays open when the pointer lands inside it", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])

    await act(async () => {
      tagOption("work").dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      )
    })

    expect(panels()[0].hasAttribute("hidden")).toBe(false)
  })

  /*
   * The bar that is not on screen keeps a copy of the disclosure mounted. If each
   * copy only recognised its own panel, the hidden one would treat a press on the
   * visible panel as outside and dismiss it under the user's finger.
   */
  it("is not dismissed by the copy belonging to the hidden bar", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[1])

    await act(async () => {
      tagOption("work").dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      )
    })

    expect(panels().every((panel) => panel.hasAttribute("hidden") === false)).toBe(
      true,
    )
  })

  it("lets a tag be chosen with the keyboard", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])

    const option = tagOption("work")

    option.focus()

    expect(document.activeElement).toBe(option)

    await click(option)

    expect(renderedTitles()).toEqual(["Alpha", "Gamma"])
  })

  it("never navigates to a route, so the URL is untouched", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])
    await click(tagOption("work"))

    expect(navigation.router.push).not.toHaveBeenCalled()
  })
})