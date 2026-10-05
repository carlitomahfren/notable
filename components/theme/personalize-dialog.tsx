"use client"

import { useEffect, useId, useRef, type MouseEvent } from "react"

import { presetAccentTokens, useTheme } from "@/components/providers/theme-provider"
import {
  COLOR_MODE_LABELS,
  COLOR_MODES,
  PRESET_DESCRIPTIONS,
  PRESET_LABELS,
  THEME_PRESETS,
  type ColorMode,
  type ThemePreset,
} from "@/lib/theme/theme-config"

interface PersonalizeDialogProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Native modal dialog, so focus containment, Escape handling, and focus
 * restoration come from the platform instead of being reimplemented.
 *
 * Contents mount only while the dialog is open. Theme values come from local
 * storage, so rendering them during hydration could disagree with the server
 * markup; mounting on open keeps that comparison out of the hydration pass.
 *
 * The dialog element is the whole window and the card is a child of it, which is
 * what makes a click outside the content recognizable without a listener on the
 * document: everything around the card is hit-tested to the dialog element itself,
 * and everything in the card is somewhere else in the tree.
 */
export function PersonalizeDialog({ isOpen, onClose }: PersonalizeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const {
    preferences,
    resolvedMode,
    isPersistent,
    setColorMode,
    setPreset,
    setAccent,
    clearAccent,
    reset,
  } = useTheme()

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (isOpen && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal()
      }
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  const accentValue =
    preferences.accent ?? presetAccentTokens(preferences.preset, resolvedMode).accent

  /*
   * A pointer that lands on the dialog element landed on the area around the card,
   * which is what a reader means by clicking outside it. Picking a preset, typing an
   * accent and pressing Done are all inside the card, so none of them can be mistaken
   * for dismissing the dialog before the choice is finished.
   */
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="personalize-dialog"
      aria-labelledby={isOpen ? titleId : undefined}
      onClick={handleClick}
      onClose={onClose}
      onCancel={onClose}
    >
      {isOpen ? (
        <div className="personalize-dialog__card">
          <h2 className="personalize-dialog__title" id={titleId}>
            Personalize
          </h2>

          <div className="personalize-dialog__body">
            <fieldset className="personalize-dialog__section">
              <legend className="personalize-dialog__legend">Color mode</legend>

              <div className="personalize-options personalize-options--mode">
                {COLOR_MODES.map((mode: ColorMode) => (
                  <label className="personalize-option" key={mode}>
                    <input
                      className="personalize-option__radio"
                      type="radio"
                      name="personalize-color-mode"
                      value={mode}
                      checked={preferences.colorMode === mode}
                      onChange={() => setColorMode(mode)}
                    />
                    <span className="personalize-option__text">
                      <span className="personalize-option__name">
                        {COLOR_MODE_LABELS[mode]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="personalize-dialog__section">
              <legend className="personalize-dialog__legend">Theme</legend>

              <div className="personalize-options personalize-options--preset">
                {THEME_PRESETS.map((preset: ThemePreset) => (
                  <label
                    className="personalize-option"
                    key={preset}
                    data-swatch-preset={preset}
                  >
                    <input
                      className="personalize-option__radio"
                      type="radio"
                      name="personalize-preset"
                      value={preset}
                      checked={preferences.preset === preset}
                      onChange={() => setPreset(preset)}
                    />

                    <span className="personalize-option__swatch" aria-hidden="true">
                      <span className="personalize-option__chip personalize-option__chip--canvas" />
                      <span className="personalize-option__chip personalize-option__chip--surface" />
                      <span className="personalize-option__chip personalize-option__chip--accent" />
                    </span>

                    <span className="personalize-option__text">
                      <span className="personalize-option__name">
                        {PRESET_LABELS[preset]}
                      </span>
                      <span className="personalize-option__description">
                        {PRESET_DESCRIPTIONS[preset]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="personalize-dialog__section">
              <legend className="personalize-dialog__legend">Custom accent</legend>

              <div className="personalize-custom">
                <input
                  className="personalize-custom__input"
                  type="color"
                  value={accentValue}
                  aria-label="Custom accent color"
                  onChange={(event) => setAccent(event.target.value)}
                />
                <span className="personalize-custom__value">{accentValue}</span>

                <button
                  type="button"
                  onClick={clearAccent}
                  disabled={preferences.accent === null}
                >
                  Use theme accent
                </button>
              </div>

              <p className="personalize-dialog__hint">
                The accent is adjusted automatically so text stays readable in
                both light and dark mode.
              </p>

              {!isPersistent ? (
                <p className="personalize-custom__status" role="alert">
                  Your choices could not be saved on this device. It will reset
                  when you reload.
                </p>
              ) : null}
            </fieldset>
          </div>

          <div className="personalize-dialog__actions">
            <button type="button" onClick={reset}>
              Reset to default
            </button>
            <button
              type="button"
              className="personalize-dialog__primary"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}