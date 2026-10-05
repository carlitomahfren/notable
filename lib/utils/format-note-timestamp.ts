const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`
}

/**
 * Formats a note timestamp as a short, deterministic label.
 * Recent notes read as relative time; older notes fall back to a date.
 * `now` is injectable so output is stable in tests.
 */
export function formatNoteTimestamp(
  iso: string,
  now: number = Date.now(),
): string {
  const time = Date.parse(iso)

  if (Number.isNaN(time)) {
    return ""
  }

  const elapsed = now - time

  if (elapsed < 0) {
    return formatCalendarDate(time)
  }

  if (elapsed < MINUTE) {
    return "Just now"
  }

  if (elapsed < HOUR) {
    return `${plural(Math.floor(elapsed / MINUTE), "min")} ago`
  }

  if (elapsed < DAY) {
    return `${plural(Math.floor(elapsed / HOUR), "hr")} ago`
  }

  if (elapsed < 2 * DAY) {
    return "Yesterday"
  }

  return formatCalendarDate(time)
}

function formatCalendarDate(time: number): string {
  const date = new Date(time)

  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/**
 * Full, unambiguous timestamp for tooltips and screen reader detail.
 */
export function formatNoteTimestampLong(iso: string): string {
  const time = Date.parse(iso)

  if (Number.isNaN(time)) {
    return ""
  }

  const date = new Date(time)

  return `${date.getFullYear()}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}