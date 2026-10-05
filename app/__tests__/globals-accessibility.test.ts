import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

/**
 * Phase 8 stylesheet audit.
 *
 * These assertions cover the invariants that unit tests cannot observe:
 * minimum pointer target sizes, motion opt-out, breakpoint coverage, and the
 * absence of decorative animation. Numeric colour contrast is verified against
 * the real token maths in `lib/theme/__tests__/theme-utils.test.ts`.
 */
const stylesheet = readFileSync(
  fileURLToPath(new URL("../globals.css", import.meta.url)),
  "utf8",
)

const stripped = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "")

interface Rule {
  selectors: string[]
  body: string
  media: string | null
}

/** Skips over a quoted string so braces inside it are never counted. */
function skipString(source: string, start: number): number {
  const quote = source[start]
  let index = start + 1

  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2
      continue
    }

    if (source[index] === quote) {
      return index + 1
    }

    index += 1
  }

  return source.length
}

/** Index of the `}` closing the block that opens just before `start`. */
function matchBrace(source: string, start: number): number {
  let depth = 1
  let index = start

  while (index < source.length) {
    const char = source[index]

    if (char === '"' || char === "'") {
      index = skipString(source, index)
      continue
    }

    if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }

    index += 1
  }

  return source.length
}

/**
 * Minimal CSS reader: enough for a flat stylesheet of rules, at-rules, and
 * media blocks. Strings are skipped so a brace inside a value cannot throw the
 * brace matching off.
 */
function parseRules(source: string, media: string | null = null): Rule[] {
  const rules: Rule[] = []

  let index = 0
  let preludeStart = 0

  while (index < source.length) {
    const char = source[index]

    if (char === '"' || char === "'") {
      index = skipString(source, index)
      continue
    }

    if (char === "{") {
      const prelude = source.slice(preludeStart, index).trim()
      const bodyStart = index + 1
      const bodyEnd = matchBrace(source, bodyStart)
      const body = source.slice(bodyStart, bodyEnd)

      if (prelude.startsWith("@")) {
        rules.push(...parseRules(body, prelude))
      } else if (prelude !== "") {
        rules.push({
          selectors: prelude.split(",").map((selector) => selector.trim()),
          body,
          media,
        })
      }

      index = bodyEnd + 1
      preludeStart = index
      continue
    }

    // A statement such as `@import "tailwindcss";` carries no block.
    if (char === ";") {
      index += 1
      preludeStart = index
      continue
    }

    index += 1
  }

  return rules
}

const rules = parseRules(stripped)

/**
 * Guards the reader above. If it ever stopped matching blocks the assertions
 * below would look for selectors that do not exist and could pass for the wrong
 * reason, so the parse is pinned to the real file.
 */
it("parses the real stylesheet", () => {
  expect(rules.length).toBeGreaterThan(150)
  expect(rules.some((rule) => rule.selectors.includes(":root"))).toBe(true)
  expect(
    rules.some((rule) => rule.media === "@supports (color: light-dark(#000, #fff))"),
  ).toBe(true)
})

function declarationsOf(rule: Rule): Map<string, string> {
  const map = new Map<string, string>()

  for (const chunk of rule.body.split(";")) {
    const colon = chunk.indexOf(":")

    if (colon === -1) {
      continue
    }

    const property = chunk.slice(0, colon).trim()
    const value = chunk.slice(colon + 1).trim()

    if (property !== "") {
      map.set(property, value)
    }
  }

  return map
}

/** Selectors whose declaration block establishes the pointer target. */
function targetSize(selector: string): { block: string | null; inline: string | null } {
  let block: string | null = null
  let inline: string | null = null

  for (const rule of rules) {
    if (!rule.selectors.includes(selector)) {
      continue
    }

    const declarations = declarationsOf(rule)
    const blockValue =
      declarations.get("min-block-size") ?? declarations.get("block-size") ?? null
    const inlineValue =
      declarations.get("min-inline-size") ?? declarations.get("inline-size") ?? null

    if (blockValue !== null) {
      block = blockValue
    }

    if (inlineValue !== null) {
      inline = inlineValue
    }
  }

  return { block, inline }
}

const REM = 16
const MIN_TARGET_REM = 2.75

function remToPx(value: string | null): number | null {
  if (value === null || value.endsWith("%") || value.endsWith("dvh")) {
    return null
  }

  if (value.endsWith("rem")) {
    return Number.parseFloat(value) * REM
  }

  if (value.endsWith("px")) {
    return Number.parseFloat(value)
  }

  return null
}

describe("pointer targets", () => {
  const CONTROLS: [string, string, boolean][] = [
    ["navigation destination", ".shell-nav-button", false],
    ["tags trigger", ".shell-tags__trigger", false],
    ["tag option", ".shell-tags__option", false],
    ["new note button", ".shell-new-note", false],
    ["search toggle", ".shell-search__toggle", true],
    ["search input", ".shell-search__input", false],
    ["search close button", ".shell-search__close", true],
    ["settings icon button", ".shell-icon-button", true],
    ["note pin button", ".note-card__pin", true],
    ["note select tick", ".note-card__select", true],
    ["note card delete", ".note-card__delete", true],
    ["selection select all", ".notes-selection__select-all", false],
    ["selection action", ".notes-selection__button", false],
    ["empty state action", ".notes-empty__actions button", false],
    ["error action", ".notes-error button", false],
    ["delete confirm action", ".confirm-dialog__actions button", false],
    ["personalize option", ".personalize-option", false],
    ["custom accent input", ".personalize-custom__input", true],
    ["personalize action", ".personalize-dialog__actions button", false],
    ["note delete button", ".editor-delete", true],
    ["editor title input", ".editor__title-input", false],
    ["tag remove button", ".editor-tags__remove", true],
    ["tag input", ".editor-tags__input", false],
    ["mode tab", ".editor-tabs__tab", false],
    ["markdown toolbar button", ".editor-toolbar__button", true],
    ["expand writing area", ".editor-expand", true],
    ["root 404 return link", ".shell-return-link", false],
  ]

  for (const [label, selector, needsInline] of CONTROLS) {
    it(`gives the ${label} at least a ${MIN_TARGET_REM}rem target`, () => {
      const { block, inline } = targetSize(selector)

      expect(remToPx(block), `${selector} min-block-size`).toBeGreaterThanOrEqual(
        MIN_TARGET_REM * REM,
      )

      if (needsInline) {
        expect(remToPx(inline), `${selector} min-inline-size`).toBeGreaterThanOrEqual(
          MIN_TARGET_REM * REM,
        )
      }
    })
  }

  it("never shrinks a target below the minimum inside a media query", () => {
    const offenders: string[] = []

    for (const rule of rules) {
      if (rule.media === null) {
        continue
      }

      const declarations = declarationsOf(rule)
      const size =
        declarations.get("min-block-size") ?? declarations.get("block-size") ?? null

      if (remToPx(size) === null) {
        continue
      }

      if ((remToPx(size) as number) < MIN_TARGET_REM * REM) {
        offenders.push(`${rule.media} { ${rule.selectors.join(", ")} }`)
      }
    }

    expect(offenders).toEqual([])
  })
})

describe("motion", () => {
  it("honours prefers-reduced-motion for animation and transitions", () => {
    const reduced = stripped.slice(
      stripped.indexOf("@media (prefers-reduced-motion: reduce)"),
    )

    expect(reduced).toContain("animation-duration: 0.01ms !important")
    expect(reduced).toContain("transition-duration: 0.01ms !important")
    expect(reduced).toContain("scroll-behavior: auto !important")
  })

  it("introduces no keyframe animation", () => {
    expect(stripped).not.toContain("@keyframes")
    expect(stripped).not.toMatch(/animation-name\s*:/)
  })

  it("keeps the reduced-motion block after every transition it must override", () => {
    const reducedIndex = stripped.indexOf("@media (prefers-reduced-motion: reduce)")

    for (const match of stripped.matchAll(/transition:/g)) {
      expect(match.index).toBeLessThan(reducedIndex)
    }
  })
})

describe("focus visibility", () => {
  it("draws a focus ring on keyboard focus", () => {
    const focusRule = rules.find((rule) =>
      rule.selectors.includes(":focus-visible"),
    )

    expect(focusRule?.body).toContain("outline: 2px solid var(--focus-ring)")
  })

  it("does not remove focus outlines anywhere", () => {
    expect(stripped).not.toMatch(/outline\s*:\s*(none|0)\b/)
  })

  it("keeps focus rings visible on the scrollable panes", () => {
    expect(stripped).toContain(".shell-pane__focus-target:focus-visible")
    expect(stripped).toContain(".editor__panel--preview:focus-visible")
  })
})

describe("responsive architecture", () => {
  it("keeps viewport heights in dynamic units", () => {
    expect(stripped).toContain("block-size: 100dvh")
    expect(stripped).not.toMatch(/\b\d+v?h\b(?<!dvh)/)
  })

  it("keeps the split and wide breakpoints", () => {
    expect(stripped).toContain("@media (min-width: 768px) and (min-height: 500px)")
    expect(stripped).toContain("@media (min-width: 1280px) and (min-height: 500px)")
  })

  it("keeps a narrow-width fallback so 320px does not squeeze dialog options", () => {
    expect(stripped).toContain("@media (max-width: 420px)")

    const narrow = stripped.slice(stripped.indexOf("@media (max-width: 420px)"))

    expect(narrow).toContain(".personalize-options--mode")
  })

  it("keeps a short-viewport fallback for the editor", () => {
    expect(stripped).toContain("@media (max-height: 560px)")
  })

  /*
   * The top bar and the bottom bar are both mounted and CSS picks one, so the
   * breakpoint that reveals the bottom bar must also be the one that hides the
   * top bar's navigation. Otherwise both would be on screen at once.
   */
  it("swaps the bottom bar in exactly when the top navigation goes away", () => {
    const phone = stripped.slice(
      stripped.indexOf("@media (max-width: 767px), (max-height: 499px)"),
    )

    expect(phone).toContain(".shell-bottom-nav")
    expect(phone).toContain(".shell-top-bar__nav")
    expect(phone).toContain(".shell-fab-layer")
  })

  it("gives the bottom bar its own grid row so it cannot cover content", () => {
    expect(stripped).toContain(`"bottomnav"`)
    expect(stripped).toContain("env(safe-area-inset-bottom)")
    expect(stripped).toContain("env(safe-area-inset-top)")
  })

  /*
   * The phone navigation is a floating pill rather than a bar.
   *
   * These assertions cover the properties that make it float: a capped width rather
   * than a stretch, a margin at both edges, a lift clear of the home indicator, and
   * space for the five destinations coming from one flex distribution. The
   * distribution is the part that matters most, because individually positioned items
   * are what let one long label overlap its neighbour.
   */
  it("floats the navigation pill instead of stretching it to the edges", () => {
    const pill = rules.find((rule) =>
      rule.selectors.includes(".shell-bottom-nav"),
    )

    expect(pill).toBeDefined()

    const declarations = declarationsOf(pill!)

    expect(declarations.get("justify-self")).toBe("center")
    expect(declarations.get("align-self")).toBe("end")
    expect(declarations.get("inline-size")).toContain("--shell-dock-max")
    expect(declarations.get("inline-size")).toContain("--shell-dock-gutter")
    expect(declarations.get("margin-block-end")).toContain(
      "env(safe-area-inset-bottom)",
    )
    expect(declarations.get("border-radius")).not.toBe("")
    expect(declarations.get("background")).not.toBe("")

    // No full-bleed border: a bar's top rule is what made it read as an edge-to-edge bar.
    expect(declarations.get("border-block-start")).toBeUndefined()
  })

  it("gives the five destinations equal shares of one flex distribution", () => {
    function flexOf(selector: string): string | undefined {
      for (const rule of rules) {
        if (rule.selectors.includes(selector)) {
          const value = declarationsOf(rule).get("flex")

          if (value !== undefined) {
            return value.replace(/\s+/g, " ")
          }
        }
      }

      return undefined
    }

// Notes and Pinned share one list, so the list takes two shares and its two
// items take one each; Home, Tags, and Settings take a single share. Five columns.
    expect(flexOf(".shell-bottom-nav .shell-primary-nav")).toBe("2 1 0")
    expect(flexOf(".shell-bottom-nav .shell-primary-nav > li")).toBe("1 1 0")
    expect(flexOf(".shell-bottom-nav .shell-tags")).toBe("1 1 0")
    expect(flexOf(".shell-bottom-nav__slot")).toBe("1 1 0")
  })

  it("positions no pill destination individually", () => {
    for (const selector of [
      ".shell-bottom-nav .shell-nav-button",
      ".shell-bottom-nav .shell-tags__trigger",
      ".shell-bottom-nav .shell-primary-nav > li",
    ]) {
      for (const rule of rules) {
        if (!rule.selectors.includes(selector)) {
          continue
        }

        const position = declarationsOf(rule).get("position")

        expect(position).not.toBe("absolute")
        expect(position).not.toBe("fixed")
      }
    }
  })

  it("aligns the create action to the same edge as the pill", () => {
    const fab = rules.find((rule) =>
      rule.selectors.includes(".shell-fab-layer"),
    )

    expect(fab).toBeDefined()
    expect(declarationsOf(fab!).get("padding")).toContain("--shell-dock-edge")
  })

  /*
   * At 320px the top bar has no slack to spare, so the question is not whether it
   * fits but what gives way when it does not. These assertions require that the
   * answer is the search field, never a control: a shrunk button is a target under
   * 44px, and an icon narrower than its own glyph is what actually reads as a
   * collision on screen.
   */
  it("lets only the search field give way in a crowded top bar", () => {
    const rule = rules.find((candidate) =>
      candidate.selectors.includes(
        ".shell-top-bar__utilities > .shell-icon-button",
      ),
    )

    expect(rule).toBeDefined()

    const declarations = declarationsOf(rule!)
    const selectors = rule!.selectors

    expect(declarations.get("flex")).toBe("none")
    expect(selectors).toContain(".shell-top-bar__utilities > .theme-quick-toggle")
    expect(selectors).toContain(".shell-top-bar__utilities > .shell-new-note")
  })

  it("tightens the top bar at 320px instead of letting it collide", () => {
    const narrow = rules.find(
      (rule) =>
        rule.media === "@media (max-width: 360px)" &&
        rule.selectors.includes(".shell-top-bar"),
    )

    expect(narrow).toBeDefined()
    expect(declarationsOf(narrow!).get("gap")).not.toBe("")

    // The search is the one thing that shrinks, and it keeps a floor.
    expect(
      rules.some(
        (rule) =>
          rule.media === "@media (max-width: 360px)" &&
          rule.selectors.includes(".shell-search__input"),
      ),
    ).toBe(true)
  })

  /*
   * The delete control is an icon with no text in it, so everything that makes it
   * usable and recognisable has to come from elsewhere: a minimum target, the
   * destructive token rather than the neutral ink, and a tooltip as well as the
   * accessible name. Without the target it is the one control on the screen a thumb
   * cannot reliably hit.
   */
  it("gives the icon-only delete control a full target and the destructive tone", () => {
    const rule = rules.find((candidate) =>
      candidate.selectors.includes(".editor-delete"),
    )

    expect(rule).toBeDefined()

    const declarations = declarationsOf(rule!)

    expect(remToPx(declarations.get("min-inline-size") ?? null)).toBeGreaterThanOrEqual(
      MIN_TARGET_REM,
    )
    expect(remToPx(declarations.get("min-block-size") ?? null)).toBeGreaterThanOrEqual(
      MIN_TARGET_REM,
    )
    expect(declarations.get("color")).toBe("var(--destructive)")
  })

  it("keeps the save status and the delete control together in the footer", () => {
    const footer = rules.find((rule) =>
      rule.selectors.includes(".editor__footer"),
    )

    expect(footer).toBeDefined()
    expect(
      rules.some((rule) =>
        rule.selectors.includes(".editor__footer > .editor-save-status"),
      ),
    ).toBe(true)
  })

  /*
 * The theme toggle's overlapping-icon bug.
 *
 * Both glyphs used to sit inside the track while a 28px thumb travelled across the
 * top of them, so whichever icon the thumb reached was partly covered. The fix is
 * structural: the icons are siblings of the track, and the thumb is confined inside
 * it. No icon is a descendant of the thing that moves over it.
 */
it("keeps the theme toggle icons outside the sliding thumb's track", () => {
  expect(
    rules.some((rule) =>
      rule.selectors.some((selector) =>
        selector.includes("theme-quick-toggle__track"),
      ),
    ),
  ).toBe(true)

  /*
   * `flex: none` on the control itself is what stops the bar squeezing it: a switch
   * whose track collapsed would bring its own icons back into contact with it.
   */
  const toggle = rules.find((rule) =>
    rule.selectors.includes(".theme-quick-toggle"),
  )

  expect(declarationsOf(toggle!).get("flex")).toBe("none")
  expect(remToPx(declarationsOf(toggle!).get("min-block-size") ?? null)).toBeGreaterThanOrEqual(
    MIN_TARGET_REM,
  )
  expect(remToPx(declarationsOf(toggle!).get("min-inline-size") ?? null)).toBeGreaterThanOrEqual(
    MIN_TARGET_REM,
  )
})

it("never animates a width, only transforms and opacity", () => {
  /*
   * The search field animates on entry. Animating `inline-size` would reflow the input
   * and the note list behind it on every frame, which costs far more than a reveal is
   * worth, so the property is pinned out of the stylesheet entirely.
   */
  for (const rule of rules) {
    const transitions = declarationsOf(rule).get("transition")

    if (transitions === undefined) {
      continue
    }

    expect(transitions, rule.selectors.join(", ")).not.toMatch(
      /\b(width|inline-size|block-size|height|all)\b/,
    )
  }
})

it("retires the old header delete button entirely", () => {
    /*
     * A leftover rule for a control that no longer exists is dead weight that will
     * be "fixed" the next time somebody reaches for that class name. The header
     * itself is gone too: the editor no longer has one, since the delete control was
     * the only thing it ever held besides the heading.
     */
    expect(stripped).not.toContain("shell-editor__delete")
    expect(stripped).not.toContain("editor__header")
  })

  /*
   * Both New note controls stay mounted so no viewport check is needed, which
   * means the stylesheet has to guarantee that only one of them is ever on
   * screen. Two identical primary actions in one view is the kind of duplication
   * no component test can catch, because both render happily together.
   */
  it("leaves exactly one New note control on screen at every size", () => {
    const barHidden = rules.find(
      (rule) =>
        rule.selectors.includes(
          ".shell-top-bar .shell-new-note[data-variant=\"bar\"]",
        ) && rule.media !== null && rule.media.includes("max-width: 767px"),
    )

    expect(barHidden?.body).toContain("display: none")

    const fabShown = rules.find(
      (rule) =>
        rule.selectors.includes(".shell-fab-layer") &&
        rule.media !== null &&
        rule.media.includes("max-width: 767px"),
    )

    expect(fabShown?.body).toContain("display: flex")

    // SHORT has no room for the floating layer, so the top bar's button returns.
    const short = stripped.slice(
      stripped.indexOf("@media (min-height: 320px) and (max-height: 499px)"),
    )

    expect(short).toContain(
      '.shell-top-bar .shell-new-note[data-variant="bar"]',
    )
    expect(short).toContain(".shell-fab-layer")
  })

  it("centres every dialog explicitly instead of relying on the user agent", () => {
    const shared = rules.find((rule) =>
      rule.selectors.includes(".confirm-dialog[open]") &&
      rule.selectors.includes(".personalize-dialog[open]"),
    )

    expect(shared).toBeDefined()
    expect(shared?.body).toContain("position: fixed")
    expect(shared?.body).toContain("inset: 0")

    /*
     * The box is the viewport and the card is centred inside it by the box's own
     * grid. The user agent's `margin: auto` centring is not relied on, because the
     * box is no longer the thing being centred.
     */
    expect(shared?.body).toContain("place-items: center")
    expect(shared?.body).toContain("margin: 0")

    for (const card of [".confirm-dialog__card", ".personalize-dialog__card"]) {
      const rule = rules.find((entry) => entry.selectors.includes(card))

      expect(rule?.body).toContain("max-block-size: min(85dvh, 40rem)")
    }
  })

  /*
   * A closed dialog is hidden by the user agent, and an ordinary author declaration
   * beats that for this element, so the window layout has to be written against
   * `[open]` and nothing may give a closed dialog a `display`, a `position` or the
   * dimming.
   *
   * The Personalize dialog is mounted on every page, so this is not theoretical: an
   * unconditional `display: grid` on the shared rule left a closed, empty, viewport-
   * sized box painted with the backdrop over the whole app. Every click hit the dialog
   * instead of the page, and there was no card on screen, because the card mounts when
   * the dialog opens.
   */
  it("draws the window layer only for a dialog that is open", () => {
    for (const dialog of [".confirm-dialog", ".personalize-dialog"]) {
      /*
       * No rule targets the bare element at all, which is the whole invariant: with
       * nothing of its own, a closed dialog is the user agent's `display: none`, which
       * no author declaration in this file is able to override.
       */
      const bare = rules.filter((rule) => rule.selectors.includes(dialog))

      expect(
        bare.map((rule) => rule.body),
        `${dialog} is styled outside [open]`,
      ).toHaveLength(0)

      const open = rules.find((entry) => entry.selectors.includes(`${dialog}[open]`))
      const declarations = declarationsOf(open!)

      expect(open).toBeDefined()
      expect(declarations.get("display")).toBe("grid")
      expect(declarations.get("position")).toBe("fixed")
      expect(declarations.get("background")).toBe("var(--backdrop)")
    }
  })

  /*
   * A click outside the content has to be recognizable from the click's own target,
   * which is what makes it work for a tap as well as a click and needs no listener
   * on the document. That is only true while the dialog element is the area around
   * the card rather than the card itself.
   */
  it("keeps the dialog box around its card so an outside click is distinguishable", () => {
    for (const dialog of [".confirm-dialog", ".personalize-dialog"]) {
      const box = rules.find((rule) =>
        rule.selectors.some(
          (selector) => selector === `${dialog}[open]` || selector === `${dialog}::backdrop`,
        ),
      )

      expect(box?.selectors).toContain(`${dialog}[open]`)

      expect(box?.body).toContain("position: fixed")
      expect(box?.body).toContain("inset: 0")

      const card = rules.find((rule) =>
        rule.selectors.some((selector) => selector.startsWith(`${dialog}__card`)),
      )

      // The card is a child box, not the dialog's own surface.
      expect(card?.selectors).not.toContain(dialog)
    }
  })

  it("keeps the interface motion inside the shared duration budget", () => {
    const durations = [
      ...stripped.matchAll(/transition:\s*[^;]*?(\d+)ms/g),
    ].map((match) => Number(match[1]))

    expect(durations.length).toBeGreaterThan(0)

    for (const duration of durations) {
      // The spec allows 150-250ms for interface motion.
      expect(duration).toBeGreaterThanOrEqual(150)
      expect(duration).toBeLessThanOrEqual(250)
    }
  })

  /*
   * The editor has no link back to the list at any width: on a phone the bottom bar
   * is the navigation, and once both panes fit the list is already beside the note.
   * The root 404 sits outside the shell and keeps its way back, so the rule has to
   * survive there and nowhere else.
   */
  it("leaves no link back to the list inside the editor", () => {
    expect(stripped).not.toContain(".shell-back-link")
    expect(stripped).toContain(".shell-return-link")
  })

  /*
   * The delete control sits at the end of the note, so the editor has to be able to
   * end above the fold: the note fills the pane, the writing surface takes the slack,
   * and the surface keeps a floor rather than a height. An editor that grew to its
   * content would push the footer off the bottom of an ordinary screen again.
   */
  it("lets the editor fill its pane so the footer stays on screen", () => {
    const pane = rules.find((rule) =>
      rule.selectors.includes(".shell-pane--editor"),
    )

    expect(declarationsOf(pane!).get("display")).toBe("flex")

    for (const selector of [".editor", ".editor__panel", ".rich-text", ".rich-text__surface"]) {
      const rule = rules.find((candidate) =>
        candidate.selectors.includes(selector),
      )

      expect(declarationsOf(rule!).get("flex"), selector).toContain("1 1 auto")
    }

    const surface = rules.find((rule) =>
      rule.selectors.includes(".rich-text__surface"),
    )!

    // The floor is a floor: small enough to leave room for the rest of the note.
    expect(remToPx(declarationsOf(surface).get("min-block-size") ?? null)).toBeLessThan(
      18 * REM,
    )
  })

  /*
   * The selection row has to stay reachable rather than scroll away, so it is a child
   * of the pane and the note list keeps its own scroll port. Anything that fixed or
   * overlaid the row would put it on top of a note or under the floating docks.
   */
  it("keeps the selection row in the list pane's own flow", () => {
    const bar = rules.find((rule) => rule.selectors.includes(".notes-selection"))

    expect(declarationsOf(bar!).get("position")).not.toBe("fixed")
    expect(declarationsOf(bar!).get("position")).not.toBe("absolute")
    expect(declarationsOf(bar!).get("flex")).toBe("none")
    // Wrapping, so four controls never have to fit a 320px row.
    expect(declarationsOf(bar!).get("flex-wrap")).toBe("wrap")
  })

  /*
   * The actions only exist once something is ticked, so they have to arrive without
   * displacing anything: taken out of flow they would sit on top of the first card
   * instead of pushing the list down, which is the one overlap a narrow list cannot
   * afford.
   */
  it("keeps the contextual actions in the row's own flow", () => {
    const actions = rules.find((rule) =>
      rule.selectors.includes(".notes-selection__actions"),
    )

    expect(declarationsOf(actions!).get("display")).toBe("flex")
    expect(declarationsOf(actions!).get("position")).not.toBe("fixed")
    expect(declarationsOf(actions!).get("position")).not.toBe("absolute")
    // The pair is one flex item, so the wrapping row drops both onto a new line
    // rather than breaking them across the count.
    expect(declarationsOf(actions!).get("flex-wrap")).toBeUndefined()
  })

it("allows scrolling rather than clipping wide code blocks", () => {
    expect(stripped).toContain(".rich-text__prose pre")
    expect(stripped).toMatch(/\.rich-text__prose pre \{[^}]*overflow-x: auto/)
  })

  /*
   * The trailing break is the only thing inside an empty paragraph, and it is the line
   * the caret has to be drawn on. A browser will not put a caret in a position it
   * cannot see, so hiding that break took the caret away with it and an empty note
   * silently swallowed every keystroke while looking ready to be typed into. The break
   * paints nothing either way, so there is nothing to gain by hiding it.
   */
  it("leaves the editor's trailing break visible enough to hold a caret", () => {
    const trailingBreakRules = rules.filter((rule) =>
      rule.selectors.some((selector) => selector.includes("ProseMirror-trailingBreak")),
    )

    for (const rule of trailingBreakRules) {
      const declarations = declarationsOf(rule)

      expect(declarations.get("visibility")).toBeUndefined()
      expect(declarations.get("display")).toBeUndefined()
      expect(declarations.get("opacity")).toBeUndefined()
    }
  })
})

describe("text legibility", () => {
  it("does not dim muted body text with opacity", () => {
    const placeholderRule = rules.find((rule) =>
      rule.selectors.includes(".shell-placeholder"),
    )

    expect(placeholderRule?.body).toContain("color: var(--muted-foreground)")
    expect(placeholderRule?.body).not.toContain("opacity")
  })

  it("reaches for the muted token rather than an opacity on card text", () => {
    /*
     * The excerpt and the meta row are the smallest text in the app. Fading them
     * with opacity rather than the token means their contrast is decided by the
     * surface underneath instead of by a value that was checked once.
     */
    for (const selector of [".note-card__excerpt", ".note-card__meta"]) {
      const rule = rules.find((candidate) => candidate.selectors.includes(selector))

      expect(rule?.body, selector).toContain("color: var(--muted-foreground)")
      expect(rule?.body, selector).not.toContain("opacity")
    }
  })

  it("gives every text input placeholder a readable colour", () => {
    for (const selector of [
      ".shell-search__input::placeholder",
      ".editor__title-input::placeholder",
      ".editor-tags__input::placeholder",
      ".link-menu__address::placeholder",
    ]) {
      const rule = rules.find((candidate) =>
        candidate.selectors.includes(selector),
      )

      expect(rule?.body, selector).toContain("color: var(--muted-foreground)")
      expect(rule?.body, selector).toContain("opacity: 1")
    }
  })

  it("keeps placeholder text off the browser default alpha", () => {
    expect(stripped).not.toMatch(/::placeholder\s*\{[^}]*opacity: 0\.[0-8]/)
  })

  it("keeps input boundaries on the strongest border token", () => {
    for (const selector of [
      ".shell-search__input",
      ".editor-tags__input",
      ".link-menu__address",
    ]) {
      const rule = rules.find((candidate) => candidate.selectors.includes(selector))

      expect(rule?.body, selector).toContain("border: 1px solid var(--border-strong)")
    }
  })

  it("keeps pointer-target boundaries on the strongest border token", () => {
    for (const selector of [".personalize-option", ".editor-toolbar__button"]) {
      const rule = rules.find((candidate) => candidate.selectors.includes(selector))

      expect(rule?.body, selector).toContain("border: 1px solid var(--border-strong)")
    }
  })

  it("paints the delete failure with the already contrast-checked pair", () => {
    const rule = rules.find((candidate) =>
      candidate.selectors.includes(".confirm-dialog__error"),
    )

    // The destructive foreground is verified against the destructive fill in
    // `theme-utils.test.ts`, so reusing the pair keeps that guarantee.
    expect(rule?.body).toContain("background: var(--destructive)")
    expect(rule?.body).toContain("color: var(--destructive-foreground)")
  })

  it("keeps visually hidden content available to assistive technology", () => {
    const rule = rules.find((candidate) =>
      candidate.selectors.includes(".visually-hidden"),
    )

    expect(rule?.body).toContain("position: absolute")
    expect(rule?.body).toContain("clip-path: inset(50%)")
    expect(rule?.body).not.toContain("display: none")
  })
})

/*
 * Corner radii, in one place.
 *
 * A radius written as a number in a rule is a decision made twice: once when the
 * scale was written and once again in the rule that uses it. These assertions keep
 * every corner in the app on the same four steps, so a card cannot quietly become
 * rounder than the panel it sits in.
 */
describe("the radius scale", () => {
  it("defines every step once, in the token block", () => {
    for (const token of [
      "--radius-inline",
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
    ]) {
      expect(stripped).toContain(`${token}:`)
    }
  })

  it("takes every corner in the app from that scale", () => {
    const values = Array.from(
      stripped.matchAll(/border-radius:\s*([^;]+);/g),
      (match) => (match[1] ?? "").trim(),
    )

    expect(values.length).toBeGreaterThan(0)

    const offScale = values.filter(
      (value) =>
        !/^var\(--radius-[a-z]+\)$/.test(value) &&
        value !== "50%" &&
        value !== "999px",
    )

    expect(offScale).toEqual([])
  })

  it("keeps a pill and a circle out of the scale", () => {
    // They are shapes, not sizes, so they are allowed to be literal.
    expect(stripped).toContain("border-radius: 999px")
    expect(stripped).toContain("border-radius: 50%")
  })
})

/*
 * The note document, and the box it is written in.
 *
 * There is one box now: the surface scrolls, and the document inside it is the note.
 * The invariants that mattered when there were two boxes still matter, only now they
 * are about where the boundary lives and what the document is allowed to draw itself,
 * so they are asserted rather than trusted.
 */
describe("the note document", () => {
  const surface = rules.find((rule) =>
    rule.selectors.includes(".rich-text__surface"),
  )
  const prose = rules.find((rule) =>
    rule.selectors.includes(".rich-text__prose"),
  )

  it("keeps the padding on the box, and draws no second box around the text", () => {
    expect(surface?.body).toContain("padding: var(--space)")

    /*
     * The editor is already inside a container, so a boundary here was a box inside a
     * box: one writing surface that read as a text field dropped into a pane. Nothing
     * draws one now, and the measure is left to the pane rather than capped here.
     */
    expect(surface?.body).not.toContain("border")

    // Padding on both would put the first line a full step further in than the edge the
    // reader clicked, which is the misalignment this arrangement exists to prevent.
    expect(prose?.body).not.toContain("padding")
    expect(prose?.body).not.toContain("border:")
    expect(declarationsOf(prose!).get("max-inline-size")).toBeUndefined()
  })

  it("scrolls rather than growing, so the footer stays on screen", () => {
    expect(surface?.body).toContain("overflow-y: auto")
  })

  /*
   * The page needs an edge whether or not anyone is typing in it. Drawn on the panel
   * rather than the surface, because the panel is now the writing area's own box with
   * the formatting row outside it, so this is a single edge around the note instead of
   * a second rectangle inside the first.
   *
   * The idle edge and the focused one are asserted separately on purpose: a hairline in
   * a token every theme already defines, and a ring that is visibly the stronger of the
   * two rather than the same line recoloured.
   */
  describe("the writing area's boundary", () => {
    const panel = rules.find(
      (rule) => rule.selectors.length === 1 && rule.selectors[0] === ".editor__panel",
    )
    const declarations = declarationsOf(panel!)

    it("is drawn on the panel, which is now the note's own box", () => {
      expect(declarations.get("border")).toContain("var(--border)")
      expect(declarations.get("border-radius")).toBe("var(--radius-md)")
    })

    /*
     * Every theme in the app defines these, so the edge arrives with the palette rather
     * than beside it. A literal colour here is what makes a boundary that survives in
     * one theme and is invisible in the other three.
     */
    it("takes its colour from tokens, so it arrives with the theme", () => {
      expect(declarations.get("border")).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(declarations.get("box-shadow")).toContain("var(--foreground)")
    })

    /*
     * A hint of depth rather than an outline in the other direction: a surface pressed
     * very slightly into what is behind it. No offset and no spread, because those are
     * what read as a second border at this size.
     */
    it("sits the panel down onto the page instead of ringing it", () => {
      expect(declarations.get("box-shadow")).toMatch(/^0 1px 2px /)
      expect(declarations.get("box-shadow")).not.toMatch(/inset/)
    })

    it("is a hairline until the note is in use", () => {
      expect(declarations.get("border")).toMatch(/^1px solid /)
    })

    it("moves only its colour, so focus does not redraw the panel", () => {
      expect(declarations.get("transition")).toContain("border-color")
      expect(declarations.get("transition")).not.toContain("box-shadow")
    })
  })

  describe("the expanded writing area", () => {
    /*
     * The attribute is what lets CSS hand the note the window, which is the whole point
     * of opening it: no second editor, no measurement in JavaScript, nothing that would
     * have to be undone when the reader closes it again.
     */
    const expanded = rules.find((rule) =>
      rule.selectors.includes('.editor[data-expanded="true"]'),
    )

    it("is reached by an attribute on the editor itself", () => {
      expect(expanded).toBeDefined()
    })

    it("takes the window rather than only asking for more room", () => {
      const declarations = declarationsOf(expanded!)

      expect(declarations.get("position")).toBe("fixed")
      expect(declarations.get("inset")).toBe("0")
      /*
       * The dynamic viewport height, so a phone's collapsing toolbar cannot leave the
       * writing area taller than the screen it is on.
       */
      expect(declarations.get("block-size")).toBe("100dvh")
    })

    it("sits above the shell and stays opaque, since it covers it", () => {
      const declarations = declarationsOf(expanded!)

      expect(declarations.get("z-index")).toBeDefined()
      expect(declarations.get("background")).toBe("var(--background)")
    })

    it("clips its own contents, so the footer cannot push the note off screen", () => {
      expect(declarationsOf(expanded!).get("overflow")).toBe("hidden")
    })
  })

  it("shows where the keyboard is, around the whole note", () => {
    const focus = rules.find((rule) =>
      rule.selectors.includes(".rich-text__surface:focus-within"),
    )

    /*
     * The ring is on the panel the writing surface sits in, not on the surface itself:
     * a rectangle drawn around the document inside the panel that already surrounds it
     * is a textbox in a textbox. What matters is that one of them draws it, and that
     * the writable document's own ring is not the visible one.
     */
    const panel = rules.find(
      (rule) =>
        rule.selectors.length === 1 &&
        rule.selectors[0] ===
          ".editor__panel:not(.editor__panel--preview):focus-within",
    )
    const editing = declarationsOf(panel!)

    expect(editing.get("outline")).toContain("2px solid var(--focus-ring)")

    /*
     * The hairline steps aside rather than staying under the ring, so focus draws one
     * edge instead of two a pixel apart. Same for the read-only panel, which is the
     * same surface with a different mode.
     */
    expect(editing.get("border-color")).toBe("transparent")
    expect(focus).toBeUndefined()

    const preview = rules.find((rule) =>
      rule.selectors.includes(".editor__panel--preview:focus-visible"),
    )

    expect(declarationsOf(preview!).get("border-color")).toBe("transparent")

    const documentRing = rules.find((rule) =>
      rule.selectors.includes(
        '.rich-text__prose[contenteditable="true"]:focus-visible',
      ),
    )

    expect(declarationsOf(documentRing!).get("outline")).toBe(
      "2px solid transparent",
    )
  })

  /*
   * A note is a page, not a field, so nothing is drawn up the edge of its scroll port.
   * The port still scrolls: this is what is hidden, not what is turned off.
   */
  it("hides the writing surface's scrollbar without closing its scroll port", () => {
    expect(declarationsOf(surface!).get("overflow-y")).toBe("auto")
    expect(declarationsOf(surface!).get("scrollbar-width")).toBe("none")
    expect(stripped).toMatch(
      /\.rich-text__surface::-webkit-scrollbar \{[^}]*display: none/,
    )
  })

  it("writes the note in the app's own type, with code as the only exception", () => {
    // 16px in the document too: a smaller size is what makes a phone zoom on focus.
    expect(declarationsOf(prose!).get("font-size")).toBe("1rem")
    expect(prose?.body).not.toContain("--stack-mono")

    const code = rules.find((rule) =>
      rule.selectors.includes(".rich-text__prose code"),
    )

    expect(code?.body).toContain("font-family: var(--stack-mono)")
  })

  it("paints the empty note's hint with the muted token", () => {
    const hint = rules.find((rule) =>
      rule.selectors.includes(".rich-text__prose .rich-text--empty::before"),
    )

    expect(hint?.body).toContain("content: attr(data-placeholder)")
    expect(hint?.body).toContain("color: var(--muted-foreground)")
    // The hint is a drawing of the note, not text in it.
    expect(hint?.body).toContain("pointer-events: none")
  })

  it("paints a selection with the app's own selection token", () => {
    expect(stripped).toMatch(
      /\.rich-text__prose ::selection \{[^}]*background: var\(--selection\)/,
    )
  })

  it("keeps a checklist's box on the accent and its text on the muted token", () => {
    expect(stripped).toContain('.rich-text__prose ul[data-type="taskList"]')
    expect(stripped).toContain("accent-color: var(--accent)")
    expect(stripped).toMatch(
      /ul\[data-type="taskList"\] li\[data-checked="true"\] > div \{[^}]*color: var\(--muted-foreground\)/,
    )
  })

  /*
   * The base layer takes the marker off every list in the app, which is right for the
   * navigation built out of lists and wrong for a note: a bulleted or numbered list with
   * nothing in front of its items reads as a stack of indented lines. The marker is the
   * one thing in a list that cannot be drawn by hand here, so it is asked for, and it
   * takes the text's own colour, which is why no preset needs a rule of its own.
   */
  it("keeps the markers on a note's bullet and numbered lists", () => {
    const bullets = rules.find(
      (rule) =>
        rule.selectors.length === 1 &&
        rule.selectors[0] === ".rich-text__prose ul",
    )
    const numbers = rules.find(
      (rule) =>
        rule.selectors.length === 1 &&
        rule.selectors[0] === ".rich-text__prose ol",
    )

    expect(declarationsOf(bullets!).get("list-style-type")).toBe("disc")
    expect(declarationsOf(numbers!).get("list-style-type")).toBe("decimal")

    // The indent is what holds the marker outside the text and lines the items up with
    // the paragraph above them.
    const indent = rules.find((rule) =>
      rule.selectors.includes(".rich-text__prose ul"),
    )

    expect(declarationsOf(indent!).get("padding-inline-start")).toBe("1.5rem")
  })

  it("leaves a checklist without a bullet of its own", () => {
    const taskList = rules.find((rule) =>
      rule.selectors.includes('.rich-text__prose ul[data-type="taskList"]'),
    )

    expect(declarationsOf(taskList!).get("list-style")).toBe("none")
    // The tick box is this list's marker, so it gives back the room one would take.
    expect(declarationsOf(taskList!).get("padding-inline-start")).toBe("0")
  })

  it("gives the link dialog a target as large as any other control", () => {
    for (const selector of [".link-menu__address", ".link-menu__button"]) {
      const rule = rules.find((candidate) => candidate.selectors.includes(selector))

      expect(remToPx(declarationsOf(rule!).get("min-block-size") ?? null), selector)
        .toBe(2.75 * REM)
    }
  })
})

/*
 * One vertical rhythm in the editor.
 *
 * The editor stacks four things: the title, the tags, the mode tabs over the
 * content, and the footer. They share two steps, so the gap before the footer is
 * visibly the same distance as the gap inside it.
 */
describe("the editor rhythm", () => {
  it("takes the editor's vertical gaps from the two space tokens", () => {
    for (const selector of [
      ".editor",
      ".editor__footer",
      ".editor__panel",
      ".editor__toolbar-row",
    ]) {
      const rule = rules.find((candidate) => candidate.selectors.includes(selector))

      expect(rule?.body, selector).toMatch(/gap:\s*var\(--space(-tight)?\)/)
    }
  })
})

/*
 * Narrow screens are decided by the stylesheet alone: no viewport API, no resize
 * listener, no orientation branch. The rules below are the width-dependent ones, so
 * they are asserted where a future edit would otherwise quietly undo them.
 */
describe("the narrow layouts", () => {
  it("wraps the tag workspace instead of overflowing it", () => {
    const header = rules.find((rule) => rule.selectors.includes(".notes-workspace"))
    const name = rules.find((rule) =>
      rule.selectors.includes(".notes-workspace__name"),
    )

    expect(header?.body).toContain("flex-wrap: wrap")
    expect(name?.body).toContain("text-overflow: ellipsis")
  })

  it("keeps the export panel narrower than the screen it opens on", () => {
    const panel = rules.find((rule) =>
      rule.selectors.includes(".export-menu__panel"),
    )

    // Anchored to the trigger's right edge, so the panel grows leftwards.
    expect(panel?.body).toContain("inset-inline-end: 0")
    expect(panel?.body).toMatch(/max-inline-size:\s*(min\(100vw|calc\(100vw)/)
  })

  it("wraps the home counts rather than letting them overflow", () => {
    const stats = rules.find((rule) => rule.selectors.includes(".home-stats"))

    expect(stats?.body).toContain("flex-wrap: wrap")
  })

  it("lowers the note's floor in a landscape phone", () => {
    const landscape = stripped.slice(stripped.indexOf("@media (max-height: 560px)"))

    expect(landscape).toMatch(/\.rich-text__surface\s*\{/)
    expect(landscape).toMatch(/min-block-size:\s*5rem/)
  })
})

/*
 * No invented names.
 *
 * A custom property that is used but never defined renders as nothing at all, which
 * in a declaration like `border-color` silently drops the border rather than failing.
 * Anything referenced with `var()` has to be either declared here or supplied at
 * runtime by `next/font`.
 */
const RUNTIME_TOKENS = new Set(["--font-geist-sans", "--font-geist-mono"])

describe("design tokens", () => {
  const declared = new Set(
    Array.from(stripped.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm), (match) =>
      (match[1] ?? "").trim(),
    ),
  )

  const referenced = new Set(
    Array.from(stripped.matchAll(/var\((--[a-z0-9-]+)/g), (match) =>
      (match[1] ?? "").trim(),
    ),
  )

  it("defines every token the stylesheet uses", () => {
    const missing = [...referenced].filter(
      (token) => !declared.has(token) && !RUNTIME_TOKENS.has(token),
    )

    expect(missing).toEqual([])
  })

  it("writes the type stacks once rather than in every rule that uses them", () => {
    expect(stripped).toContain("--stack-mono: var(--font-geist-mono)")
    expect(stripped).toContain("--stack-body: Arial, Helvetica, sans-serif")

    // The literals themselves appear only in the token block.
    expect(
      (stripped.match(/ui-monospace, monospace/g) ?? []).length,
    ).toBe(1)
  })

  it("derives the note's selection from the app's own selection token", () => {
    const selection = rules.find((rule) =>
      rule.selectors.includes(".rich-text__prose ::selection"),
    )

    // The text is visible now, so a selection is the reader's own wash of colour rather
    // than a translucent film laid over glyphs the caret cannot see.
    expect(selection?.body).toContain("background: var(--selection)")
    expect(selection?.body).not.toContain("transparent")
  })
})
