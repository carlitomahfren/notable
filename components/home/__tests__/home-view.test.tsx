// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HomeView } from "@/components/home/home-view"
import { HomeNavLink } from "@/components/shell/home-nav-link"
import { makeNote, resetNoteIds } from "@/lib/notes/__tests__/note-factory"

import {
  byLabelText,
  click,
  query,
  queryAll,
  render,
  unmountAll,
} from "@/components/notes/__tests__/test-render"
import {
  clearStorage,
  renderWithProviders,
  seedStorage,
} from "@/components/notes/__tests__/test-harness"

const navigation = vi.hoisted(() => ({
  pathname: { value: "/" },
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname.value,
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

beforeEach(async () => {
  clearStorage()
  resetNoteIds()
  navigation.pathname.value = "/"
  await seedStorage([])
})

afterEach(async () => {
  await unmountAll()
  clearStorage()
})

function stat(container: ParentNode, label: string): string | null {
  const group = queryAll(".home-stat", container).find(
    (element) =>
      element.querySelector(".home-stat__label")?.textContent?.trim() === label,
  )

  return group?.querySelector(".home-stat__value")?.textContent?.trim() ?? null
}

describe("the home page", () => {
  it("says what the app is and offers the way into it", async () => {
    const container = await renderWithProviders(<HomeView />)

    expect(query(".home__title", container)?.textContent?.trim()).toBe(
      "Your notebook",
    )
    expect(query(".home__lede", container)?.textContent).toContain("Markdown")

    const action = query<HTMLAnchorElement>(".home__action", container)

    expect(action?.getAttribute("href")).toBe("/notes")
    expect(action?.textContent).toContain("Open Notes")
  })

  it("counts the notebook without opening it", async () => {
    await seedStorage([
      makeNote({ title: "Alpha", tags: ["work", "ideas"] }),
      makeNote({ title: "Beta", tags: ["ideas"] }),
      makeNote({ title: "Gamma", isPinned: true }),
    ])

    const container = await renderWithProviders(<HomeView />)

    expect(stat(container, "Notes")).toBe("3")
    expect(stat(container, "Pinned")).toBe("1")
    expect(stat(container, "Tags")).toBe("2")
  })

  it("keeps the appearance control within reach", async () => {
    const container = await renderWithProviders(<HomeView />)

    const toggle = byLabelText("Dark mode", container)

    expect(toggle).not.toBeNull()

    const before = toggle?.getAttribute("aria-checked")

    await click(toggle as HTMLElement)

    expect(toggle?.getAttribute("aria-checked")).not.toBe(before)
  })

  it("holds one main landmark and one heading", async () => {
    const container = await renderWithProviders(<HomeView />)

    expect(queryAll("main", container)).toHaveLength(1)
    expect(queryAll("h1", container)).toHaveLength(1)
  })

  it("does not reach into the workspace it is meant to leave", async () => {
    await seedStorage([makeNote({ title: "Alpha" })])

    const container = await renderWithProviders(<HomeView />)

    // No list and no editor here: the page is a doorway, not a second workspace.
    expect(query(".note-list", container)).toBeNull()
    expect(query(".note-editor", container)).toBeNull()
    expect(query(".notes-selection", container)).toBeNull()
  })
})

describe("the home destination", () => {
  it("is a real link to the root", async () => {
    const container = await render(<HomeNavLink />)

    const link = query(".shell-home-link", container)

    expect(link?.getAttribute("href")).toBe("/")
    expect(link?.textContent).toContain("Home")
  })

  it("marks itself current only on the landing page", async () => {
    navigation.pathname.value = "/"

    const onHome = await render(<HomeNavLink />)

    expect(
      query(".shell-home-link", onHome)?.getAttribute("aria-current"),
    ).toBe("page")

    await unmountAll()

    navigation.pathname.value = "/notes"

    const inWorkspace = await render(<HomeNavLink />)

    expect(
      query(".shell-home-link", inWorkspace)?.getAttribute("aria-current"),
    ).toBeNull()
  })
})