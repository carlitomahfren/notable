// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { audit } from "./axe-audit"

/**
 * Guards the audit suite itself. Without this, a broken `audit()` helper would
 * make every "no violations" assertion pass vacuously, which is the one failure
 * mode an accessibility test file cannot detect on its own.
 */
describe("axe harness", () => {
  it("reports violations for a deliberately broken tree", async () => {
    const host = document.createElement("div")

    host.innerHTML = [
      '<img src="x.png">',
      "<button></button>",
      '<input type="text">',
      '<div role="button"></div>',
      "<select></select>",
      '<a href="/x"></a>',
    ].join("")

    document.body.appendChild(host)

    const found = (await audit(host)).map((violation) => violation.id)

    expect(found).toEqual(
      expect.arrayContaining([
        "image-alt",
        "button-name",
        "label",
        "aria-command-name",
        "select-name",
        "link-name",
      ]),
    )

    host.remove()
  })
})