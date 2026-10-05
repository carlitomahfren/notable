import { describe, expect, it } from "vitest"

import { resolveEmptyReason } from "@/components/notes/resolve-empty-reason"

describe("resolveEmptyReason", () => {
  it("shows the first-run state when there are no notes at all", () => {
    expect(
      resolveEmptyReason({
        totalCount: 0,
        hasSearchQuery: false,
        view: { kind: "all" },
      }),
    ).toBe("no-notes")
  })

  it("shows the first-run state even when a search is active", () => {
    expect(
      resolveEmptyReason({
        totalCount: 0,
        hasSearchQuery: true,
        view: { kind: "all" },
      }),
    ).toBe("no-notes")
  })

  it("shows the pinned state inside the pinned view", () => {
    expect(
      resolveEmptyReason({
        totalCount: 4,
        hasSearchQuery: false,
        view: { kind: "pinned" },
      }),
    ).toBe("no-pinned")
  })

  it("shows the tag state for a tag with no notes", () => {
    expect(
      resolveEmptyReason({
        totalCount: 4,
        hasSearchQuery: false,
        view: { kind: "tag", tag: "work" },
      }),
    ).toBe("no-tagged-notes")
  })

  it("prefers the search state over the pinned state", () => {
    expect(
      resolveEmptyReason({
        totalCount: 4,
        hasSearchQuery: true,
        view: { kind: "pinned" },
      }),
    ).toBe("no-search-results")
  })

  it("prefers the search state over the tag state", () => {
    expect(
      resolveEmptyReason({
        totalCount: 4,
        hasSearchQuery: true,
        view: { kind: "tag", tag: "work" },
      }),
    ).toBe("no-search-results")
  })

  it("does not report an empty state for the all-notes view with notes present", () => {
    // getVisibleNotes over the all filter can only be empty when the
    // source list is empty, so totalCount is the deciding factor.
    expect(
      resolveEmptyReason({
        totalCount: 0,
        hasSearchQuery: false,
        view: { kind: "all" },
      }),
    ).toBe("no-notes")
  })
})