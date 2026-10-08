import { describe, expect, it } from "vitest"

import { projectVisibleReorderToFull } from "@/lib/notes/reorder"

const full = ["a", "b", "c", "d", "e"]

describe("projectVisibleReorderToFull", () => {
  it("applies a front move in the all-notes view", () => {
    expect(
      projectVisibleReorderToFull(full, ["c", "a", "b", "d", "e"], "c"),
    ).toEqual(["c", "a", "b", "d", "e"])
  })

  it("applies an end move in the all-notes view", () => {
    expect(
      projectVisibleReorderToFull(full, ["b", "c", "d", "e", "a"], "a"),
    ).toEqual(["b", "c", "d", "e", "a"])
  })

  it("drops a note right after the note it follows in the slice", () => {
    // Only a, c, e visible; c dragged below e, so c lands where e sits.
    expect(projectVisibleReorderToFull(full, ["a", "e", "c"], "c")).toEqual([
      "a",
      "b",
      "d",
      "e",
      "c",
    ])
  })

  it("leads with a moved note when nothing precedes it in the slice", () => {
    // Only b, d visible; d dragged to the front of the slice.
    expect(projectVisibleReorderToFull(full, ["d", "b"], "d")).toEqual([
      "d",
      "a",
      "b",
      "c",
      "e",
    ])
  })

  it("keeps every hidden note's relative order intact", () => {
    // Hidden notes are b, c and d; e moves ahead of them all.
    expect(projectVisibleReorderToFull(full, ["e", "a", "c"], "e")).toEqual([
      "e",
      "a",
      "b",
      "c",
      "d",
    ])
  })

  it("returns the same sequence when the order is unchanged", () => {
    expect(
      projectVisibleReorderToFull(full, ["a", "b", "c", "d", "e"], "c"),
    ).toEqual(full)
  })

  it("returns a copy of the full order when the moved id is not visible", () => {
    const result = projectVisibleReorderToFull(full, ["a", "b", "c"], "a")

    expect(result).toEqual(full)
    expect(result).not.toBe(full)
  })

  it("returns a copy of the full order when the predecessor is missing", () => {
    const result = projectVisibleReorderToFull(
      full,
      ["a", "b", "missing", "c"],
      "c",
    )

    expect(result).toEqual(full)
  })

  it("does not mutate either input array", () => {
    const visible = ["a", "c", "e"]

    projectVisibleReorderToFull(full, visible, "e")

    expect(visible).toEqual(["a", "c", "e"])
    expect(full).toEqual(["a", "b", "c", "d", "e"])
  })
})