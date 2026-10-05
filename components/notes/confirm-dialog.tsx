"use client"

import { useEffect, useId, useRef, useState, type MouseEvent } from "react"

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => Promise<void>
}

/**
 * The shape every destructive confirmation in the app shares.
 *
 * Native modal dialog, so focus containment, Escape handling, and focus
 * restoration are provided by the platform rather than reimplemented.
 *
 * The dialog element is the whole window and the card is a child of it, which is
 * what makes a click outside the content recognizable without a listener on the
 * document: everything around the card is hit-tested to the dialog element itself,
 * and everything in the card is somewhere else in the tree.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Delete",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const bodyId = useId()
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  /*
   * A delete can genuinely fail, for example when storage is full. The list pane
   * owns the shared mutation error, but it sits behind this modal, so the dialog
   * reports the failure itself and stays open for another attempt.
   */
  const handleConfirm = async () => {
    if (isConfirming) {
      return
    }

    setError(null)
    setIsConfirming(true)

    try {
      await onConfirm()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancel = () => {
    setError(null)
    onCancel()
  }

  /*
   * A pointer that lands on the dialog element landed on the area around the card,
   * which is what a reader means by clicking outside it. A pointer anywhere in the
   * card is in the tree instead, so reading the question, choosing Cancel and
   * confirming all still reach their own handlers and none of them dismisses.
   */
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      handleCancel()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      /* The consequence is announced with the question, not left to be found. */
      aria-describedby={bodyId}
      onClick={handleClick}
      onClose={handleCancel}
      onCancel={handleCancel}
    >
      <div className="confirm-dialog__card">
        <h2 className="confirm-dialog__title" id={titleId}>
          {title}
        </h2>

        <p className="confirm-dialog__body" id={bodyId}>
          {description}
        </p>

        {error !== null ? (
          <p className="confirm-dialog__error" role="alert">
            Could not complete the deletion. {error}
          </p>
        ) : null}

        <div className="confirm-dialog__actions">
          <button type="button" onClick={handleCancel} disabled={isConfirming}>
            Cancel
          </button>
          <button
            type="button"
            className="confirm-dialog__confirm"
            onClick={() => void handleConfirm()}
            disabled={isConfirming}
          >
            {isConfirming ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}