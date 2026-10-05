import { describe, expect, it } from "vitest"
import { normalizeTags } from "@/lib/notes/tag-utils"
import { validateAndNormalizeTags } from "@/lib/notes/validators"
import { ValidationError } from "@/types/note"

describe("normalizeTags", () => {
  it("returns an empty array for no tags", () => {
    expect(normalizeTags([])).toEqual([])
  })

  it("trims surrounding whitespace", () => {
    expect(normalizeTags(["  school  "])).toEqual(["school"])
  })

  it("collapses internal whitespace", () => {
    expect(normalizeTags(["my   big    tag"])).toEqual(["my big tag"])
  })

  it("lowercases", () => {
    expect(normalizeTags(["ScHoOl"])).toEqual(["school"])
  })

  it("removes a single leading hash", () => {
    expect(normalizeTags(["#school"])).toEqual(["school"])
  })

  it("does not strip a second hash", () => {
    expect(normalizeTags(["##school"])).toEqual(["#school"])
  })

  it("drops empty and whitespace-only values", () => {
    expect(normalizeTags(["", "   ", "\t\n"])).toEqual([])
  })

  it("drops a lone hash", () => {
    expect(normalizeTags(["#"])).toEqual([])
  })

  it("deduplicates while preserving first-occurrence order", () => {
    expect(normalizeTags(["work", "School", "work", "#school"])).toEqual([
      "work",
      "school",
    ])
  })

  it("applies Unicode NFC normalization", () => {
    const decomposed = "cafe\u0301"

    expect(normalizeTags([decomposed])).toEqual(["caf\u00e9"])
  })

  it("handles a realistic mixed input", () => {
    expect(
      normalizeTags([
        "  #School  ",
        "work",
        "WORK",
        "",
        "#",
        "My  Personal Tag",
        "caf\u0065\u0301",
      ]),
    ).toEqual(["school", "work", "my personal tag", "caf\u00e9"])
  })

  it("preserves commas for validation to reject", () => {
    expect(normalizeTags(["a,b"])).toEqual(["a,b"])
  })
})

describe("validateAndNormalizeTags", () => {
  it("normalizes valid tags", () => {
    expect(validateAndNormalizeTags(["  #School  ", "WORK"])).toEqual([
      "school",
      "work",
    ])
  })

  it("throws a ValidationError for a tag containing a comma", () => {
    expect(() => validateAndNormalizeTags(["a,b"])).toThrow(ValidationError)
  })

  it("throws a ValidationError with a readable message", () => {
    expect(() => validateAndNormalizeTags(["a,b"])).toThrow(
      /cannot contain commas/,
    )
  })

  it("validates after normalization, so padded commas are still rejected", () => {
    expect(() => validateAndNormalizeTags(["  #Work, Life  "])).toThrow(
      ValidationError,
    )
  })

  it("accepts an arbitrarily large number of tags", () => {
    const tags = Array.from({ length: 500 }, (_, index) => `tag${index}`)

    expect(validateAndNormalizeTags(tags)).toHaveLength(500)
  })

  it("accepts an arbitrarily long tag", () => {
    const tag = "a".repeat(500)

    expect(validateAndNormalizeTags([tag])).toEqual([tag])
  })
})