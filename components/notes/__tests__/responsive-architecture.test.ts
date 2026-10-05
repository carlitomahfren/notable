import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const projectRoot = fileURLToPath(new URL("../../..", import.meta.url))

function sourceFiles(directory: string): string[] {
  const found: string[] = []

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)

    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") {
        continue
      }

      found.push(...sourceFiles(path))
      continue
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      found.push(path)
    }
  }

  return found
}

const SCANNED = ["app", "components", "lib"].flatMap((directory) =>
  sourceFiles(join(projectRoot, directory)).map((path) => ({
    path,
    relative: path.slice(projectRoot.length),
    contents: readFileSync(path, "utf8"),
  })),
)

/**
 * The responsive architecture is CSS-only by decision. A viewport measurement in
 * JavaScript would introduce a second, non-deterministic breakpoint source, which
 * is a regression rather than an implementation detail.
 */
describe("responsive architecture", () => {
  it("performs no JavaScript viewport detection", () => {
    const offenders: string[] = []

    for (const { relative, contents } of SCANNED) {
      for (const api of [
        "innerWidth",
        "innerHeight",
        "outerWidth",
        "screen.width",
        "screen.height",
        "visualViewport",
        "orientationchange",
      ]) {
        if (contents.includes(api)) {
          offenders.push(`${relative}: ${api}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it("uses matchMedia only for the colour-scheme preference", () => {
    const matches = SCANNED.filter((file) => file.contents.includes("matchMedia")).map(
      (file) => file.relative,
    )

    expect(matches).toEqual(["components\\providers\\theme-provider.tsx"])
  })

  it("reads the resolved viewport size only through CSS", () => {
    /*
     * Both panes and the sidebar size themselves from `100dvh` and media
     * queries; there is no JavaScript layout measurement to fall out of step.
     */
    const offenders = SCANNED.filter((file) =>
      file.contents.includes("getBoundingClientRect"),
    ).map((file) => file.relative)

    expect(offenders).toEqual([])
  })
})

/**
 * Functional iconography comes from Lucide. An emoji would render at a different
 * size, weight and colour on every platform, and would ignore the theme, so one
 * creeping back in is a visual regression that no single component test would
 * catch.
 */
describe("iconography", () => {
  it("contains no emoji in shipped source", () => {
    const emoji = /\p{Extended_Pictographic}/u
    const offenders: string[] = []

    for (const { relative, contents } of SCANNED) {
      contents.split(/\r?\n/).forEach((line, index) => {
        if (emoji.test(line)) {
          offenders.push(`${relative}:${index + 1}: ${line.trim()}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })
})