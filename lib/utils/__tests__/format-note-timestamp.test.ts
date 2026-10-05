import { describe, expect, it } from "vitest"

import {
  formatNoteTimestamp,
  formatNoteTimestampLong,
} from "@/lib/utils/format-note-timestamp"

const NOW = Date.parse("2026-03-15T12:00:00.000Z")

function iso(offsetMs: number): string {
  return new Date(NOW - offsetMs).toISOString()
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe("formatNoteTimestamp", () => {
  it("returns an empty string for an unparseable timestamp", () => {
    expect(formatNoteTimestamp("not-a-date", NOW)).toBe("")
  })

  it("labels sub-minute notes as just now", () => {
    expect(formatNoteTimestamp(iso(0), NOW)).toBe("Just now")
    expect(formatNoteTimestamp(iso(MINUTE - 1), NOW)).toBe("Just now")
  })

  it("labels minutes", () => {
    expect(formatNoteTimestamp(iso(MINUTE), NOW)).toBe("1 min ago")
    expect(formatNoteTimestamp(iso(5 * MINUTE), NOW)).toBe("5 mins ago")
  })

  it("labels hours", () => {
    expect(formatNoteTimestamp(iso(HOUR), NOW)).toBe("1 hr ago")
    expect(formatNoteTimestamp(iso(5 * HOUR), NOW)).toBe("5 hrs ago")
  })

  it("labels yesterday for the previous day", () => {
    expect(formatNoteTimestamp(iso(DAY), NOW)).toBe("Yesterday")
    expect(formatNoteTimestamp(iso(2 * DAY - 1), NOW)).toBe("Yesterday")
  })

  it("falls back to a calendar date beyond two days", () => {
    const label = formatNoteTimestamp(iso(3 * DAY), NOW)

    expect(label).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/)
  })

  it("falls back to a calendar date for future timestamps", () => {
    const label = formatNoteTimestamp(iso(-DAY), NOW)

    expect(label).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/)
  })

  it("is deterministic for the same inputs", () => {
    const timestamp = iso(3 * HOUR)

    expect(formatNoteTimestamp(timestamp, NOW)).toBe(
      formatNoteTimestamp(timestamp, NOW),
    )
  })
})

describe("formatNoteTimestampLong", () => {
  it("returns an empty string for an unparseable timestamp", () => {
    expect(formatNoteTimestampLong("nope")).toBe("")
  })

  it("includes year, month, day, and 24-hour time", () => {
    expect(formatNoteTimestampLong("2026-03-15T09:05:00.000Z")).toMatch(
      /^\d{4}, [A-Z][a-z]{2} \d{1,2}, \d{2}:\d{2}$/,
    )
  })
})