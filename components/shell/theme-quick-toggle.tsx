"use client"

import { Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/providers/theme-provider"

/**
 * A two-state control, so it is a switch rather than a pair of buttons: pressing
 * it always moves to the opposite mode, and assistive technology can read the
 * current state from one control instead of inferring it from two.
 *
 * Only Light and Dark are reachable from here. When the stored preference is still
 * `system`, the first press pins the explicit opposite of what is on screen, which
 * is the only unambiguous reading of "turn it off" or "turn it on". System stays in
 * Personalize, where it is a labelled choice rather than a guess.
 *
 * The icons sit outside the track on purpose. An earlier version laid both icons
 * inside the track and floated a 28px thumb over them, which meant the thumb
 * overlapped whichever icon it passed; here the thumb is confined to a track of
 * its own and can never reach an icon.
 */
export function ThemeQuickToggle() {
  const { resolvedMode, setColorMode } = useTheme()
  const isDark = resolvedMode === "dark"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      className="theme-quick-toggle"
      data-mode={resolvedMode}
      onClick={() => {
        setColorMode(isDark ? "light" : "dark")
      }}
    >
      <Sun
        aria-hidden="true"
        className="theme-quick-toggle__icon theme-quick-toggle__icon--sun"
      />

      <span className="theme-quick-toggle__track" aria-hidden="true">
        <span className="theme-quick-toggle__thumb" />
      </span>

      <Moon
        aria-hidden="true"
        className="theme-quick-toggle__icon theme-quick-toggle__icon--moon"
      />
    </button>
  )
}