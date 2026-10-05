"use client"

import { Check, CloudUpload, PencilLine, TriangleAlert } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { SaveStatus } from "@/components/editor/use-note-draft"

const LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving changes",
  error: "Not saved",
}

const ICONS: Record<SaveStatus, LucideIcon> = {
  saved: Check,
  dirty: PencilLine,
  saving: CloudUpload,
  error: TriangleAlert,
}

interface SaveStatusProps {
  status: SaveStatus
  error: string | null
}

/**
 * Save feedback that never relies on colour alone: every state carries its own
 * icon and a text label. Only settled states are announced, so normal typing does
 * not produce a stream of "Saving changes" interruptions.
 */
export function SaveStatusIndicator({ status, error }: SaveStatusProps) {
  const Icon = ICONS[status]

  const announcement =
    status === "saved"
      ? "Saved."
      : status === "error"
        ? `Not saved. ${error ?? "This note could not be saved."}`
        : ""

  return (
    <div className="editor-save-status" data-state={status}>
      <Icon aria-hidden="true" className="editor-save-status__icon" />

      <span className="editor-save-status__label">{LABELS[status]}</span>

      {/* Visible as well as announced, so the failure is understandable
          without assistive technology. */}
      {error !== null && status === "error" ? (
        <p className="editor-save-status__detail">{error}</p>
      ) : null}

      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}