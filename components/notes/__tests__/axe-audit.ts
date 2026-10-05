import axe from "axe-core"

/**
 * Thin wrapper around `axe-core` for the Phase 8 audit.
 *
 * Only rules that can produce a real verdict in jsdom are run. Colour-contrast
 * rules are excluded because jsdom performs no layout or paint, so computed
 * colours are unavailable; the contrast matrix is covered separately by the
 * token maths in `lib/theme/__tests__/theme-utils.test.ts`.
 */
const DISABLED_RULES = ["color-contrast", "color-contrast-enhanced"]

export interface AxeViolation {
  id: string
  impact: string | null
  help: string
  nodes: { target: string[]; failureSummary?: string }[]
}

export async function audit(
  root: Element | Document,
): Promise<AxeViolation[]> {
  const results = await axe.run(root, {
    // Form fields are audited for names and states rather than for the browser's
    // own autofill heuristics, which have no DOM equivalent here.
    rules: {
      "color-contrast": { enabled: false },
      "color-contrast-enhanced": { enabled: false },
    },
    resultTypes: ["violations"],
  })

  void DISABLED_RULES

  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? null,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target.map(String),
      failureSummary: node.failureSummary,
    })),
  }))
}

/** Single-line summary so a failing assertion stays readable. */
export function describeViolations(violations: AxeViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help} -> ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ")}`,
    )
    .join("\n")
}