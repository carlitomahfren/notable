// @vitest-environment jsdom

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
  navButton,
  query,
  queryAll,
  renderedTitles,
  selectValue,
  tagFilter,
  tagOption,
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

/** The desktop bar comes first in the document; the mobile copy follows. */
function triggers(): HTMLButtonElement[] {
  return queryAll<HTMLButtonElement>(".shell-tags__trigger", document)
}

async function openSearch(): Promise<HTMLInputElement> {
  await click(query(".shell-search__toggle", document) as HTMLElement)

  const input = query<HTMLInputElement>('input[type="search"]', document)

  if (input === null) {
    throw new Error("search input not found")
  }

  return input
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

describe("the Tags navigation destination", () => {
  it("is a destination like All Notes, not a disclosure", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    const trigger = triggers()[0]

    expect(trigger.hasAttribute("aria-expanded")).toBe(false)
    expect(trigger.hasAttribute("aria-controls")).toBe(false)
    expect(query(".shell-tags__panel", document)).toBeNull()
  })

  it("opens the Tags workspace, which shows every note, tagged or not", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work"] }),
      makeNote({ title: "Beta", tags: ["home"] }),
      makeNote({ title: "Gamma", tags: ["work", "home"] }),
      makeNote({ title: "Delta" }),
    ])
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])

    expect(query(".notes-workspace__name", document)?.textContent?.trim()).toBe(
      "Tags",
    )
    expect(tagFilter().value).toBe("")
    expect(renderedTitles()).toHaveLength(4)
    expect(renderedTitles()).toEqual(
      expect.arrayContaining(["Alpha", "Beta", "Gamma", "Delta"]),
    )
  })

  it("keeps the search field and query when Tags is opened", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await type(await openSearch(), "home")

    await click(triggers()[0])

    expect(query(".shell-search__field", document)?.hasAttribute("hidden")).toBe(
      false,
    )
    expect(query<HTMLInputElement>('input[type="search"]', document)?.value).toBe(
      "home",
    )
  })

  it("marks the trigger current while its workspace or a tag in it is active", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(triggers()[0].hasAttribute("aria-current")).toBe(false)

    await click(triggers()[0])

    expect(triggers()[0].getAttribute("aria-current")).toBe("true")

    await selectValue(tagFilter(), "work")

    expect(triggers()[0].getAttribute("aria-current")).toBe("true")
    expect(renderedTitles()).toEqual(["Alpha", "Gamma"])

    await click(navButton("All Notes"))

    expect(triggers()[0].hasAttribute("aria-current")).toBe(false)
  })

  it("returns to the whole workspace when its destination is asked for again", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])
    await selectValue(tagFilter(), "work")

    expect(renderedTitles()).toEqual(["Alpha", "Gamma"])

    await click(triggers()[0])

    expect(tagFilter().value).toBe("")
    expect(renderedTitles()).toHaveLength(3)
  })

  it("shows both bar copies as the same single destination", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    expect(triggers()).toHaveLength(2)

    await click(triggers()[1])

    expect(query(".notes-workspace__name", document)?.textContent?.trim()).toBe(
      "Tags",
    )
    expect(triggers()[1].getAttribute("aria-current")).toBe("true")
  })

  it("names the filter options with the tag for legibility", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])

    expect(tagOption("work").textContent).toBe("#work")
    expect(tagOption("home").textContent).toBe("#home")
  })

  it("never navigates to a route, so the URL is untouched", async () => {
    await renderWithProviders(<NotesShell>{null}</NotesShell>)

    await click(triggers()[0])
    await selectValue(tagFilter(), "work")

    expect(navigation.router.push).not.toHaveBeenCalled()
  })
})