"use client"

import { useEffect, useState } from "react"

// Release the node just after the ~2.1s hold and the 450ms dissolve complete.
const DISMISS_MS = 2700

type SplashStage = "idle" | "settling" | "entering" | "gone"

/**
 * One-shot entrance for a full document load: the workspace briefly shows its
 * wordmark and then gets out of the way.
 *
 * The timing comes from the last full load, not from storage or the router:
 * the root layout mounts once per document, so this component rests until a
 * fresh page (hard refresh, direct entry, or a new tab) brings its mount
 * effect back. A soft navigation never unmounts the layout, so it never
 * re-runs here, and the splash cannot replay between `/notes` and a note.
 *
 * The stages are forced through two frames so the browser paints the pre-live
 * ("hidden") state before the reveal class is applied; without that painted
 * frame the state change would be the first render and the transitions would
 * have no start point to interpolate from.
 */
export function AppSplash() {
  const [stage, setStage] = useState<SplashStage>("idle")

  useEffect(() => {
    const frame = requestAnimationFrame(() => setStage("settling"))
    // Dismissal is owned by the mount, not by the settling stage: if the stage
    // moved on before the timer ran the cleanup would cancel it and the overlay
    // would stay up forever.
    const dismiss = window.setTimeout(() => setStage("gone"), DISMISS_MS)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(dismiss)
    }
  }, [])

  useEffect(() => {
    if (stage !== "settling") {
      return
    }

    const frame = requestAnimationFrame(() => setStage("entering"))

    return () => cancelAnimationFrame(frame)
  }, [stage])

  if (stage === "idle" || stage === "gone") {
    return null
  }

  return (
    <div
      className="app-splash"
      data-state={stage === "entering" ? "entering" : undefined}
      role="presentation"
      aria-hidden="true"
    >
      <div className="app-splash__inner">
        <span className="app-splash__mark">Notable</span>
        <span className="app-splash__rule" />
      </div>
    </div>
  )
}