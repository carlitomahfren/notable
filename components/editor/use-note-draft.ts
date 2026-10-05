"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useNotesActions } from "@/components/providers/notes-provider"
import {
  AUTOSAVE_DELAY_MS,
  AUTOSAVE_MAX_WAIT_MS,
  createAutosaveController,
  type AutosaveController,
} from "@/lib/editor/autosave-controller"
import type { Note, NoteUpdate } from "@/types/note"

export type SaveStatus = "saved" | "dirty" | "saving" | "error"

export interface NoteDraft {
  title: string
  content: string
  tags: string[]
}

function toDraft(note: Note): NoteDraft {
  return { title: note.title, content: note.content, tags: [...note.tags] }
}

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index])
}

/** Only the fields that actually differ from the last persisted snapshot. */
function diffDraft(draft: NoteDraft, baseline: NoteDraft): NoteUpdate {
  const patch: NoteUpdate = {}

  if (draft.title !== baseline.title) {
    patch.title = draft.title
  }

  if (draft.content !== baseline.content) {
    patch.content = draft.content
  }

  if (!sameTags(draft.tags, baseline.tags)) {
    patch.tags = draft.tags
  }

  return patch
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message !== ""
    ? error.message
    : "This note could not be saved."
}

/**
 * Local draft state for one note plus autosave through the existing provider
 * and mutation queue. Mount this with a `key` of the note id so each note gets
 * an isolated draft that can never bleed into another note.
 */
export function useNoteDraft(note: Note, autosaveAbandoned: boolean) {
  const { updateNote } = useNotesActions()
  const [draft, setDraft] = useState<NoteDraft>(() => toDraft(note))
  const [status, setStatus] = useState<SaveStatus>("saved")
  const [saveError, setSaveError] = useState<string | null>(null)

  // Written from edit/commit only, never during render.
  const draftRef = useRef<NoteDraft>(draft)
  const baselineRef = useRef<NoteDraft>(toDraft(note))
  const revisionRef = useRef(0)
  const controllerRef = useRef<AutosaveController | null>(null)

  const commit = useCallback(async () => {
    const snapshot = draftRef.current
    const patch = diffDraft(snapshot, baselineRef.current)
    const revisionAtStart = revisionRef.current

    if (Object.keys(patch).length === 0) {
      setSaveError(null)
      setStatus("saved")
      return
    }

    setStatus("saving")

    try {
      // The provider owns the queue, the repository owns updatedAt.
      const saved = await updateNote(note.id, patch)

      baselineRef.current = toDraft(saved)

      // Newer edits landed mid-flight: keep the user's text untouched and let
      // the controller's follow-up attempt persist the remainder.
      if (revisionRef.current === revisionAtStart) {
        const next: NoteDraft = { ...draftRef.current, tags: [...saved.tags] }

        draftRef.current = next
        setDraft(next)
        setSaveError(null)
        setStatus("saved")
      }
    } catch (error) {
      // The draft stays exactly as typed, so nothing is lost and a later
      // attempt can still recover.
      setSaveError(describeError(error))
      setStatus("error")
    }
  }, [note.id, updateNote])

  useEffect(() => {
    const controller = createAutosaveController({
      delay: AUTOSAVE_DELAY_MS,
      maxWait: AUTOSAVE_MAX_WAIT_MS,
      isDirty: () =>
        Object.keys(diffDraft(draftRef.current, baselineRef.current)).length > 0,
      commit,
    })

    controllerRef.current = controller

    // Unmount, tab hiding, page exit, and Ctrl/Cmd+S all persist a dirty draft
    // through the queue rather than a synchronous storage write.
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void controller.flush()
      }
    }

    const onSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void controller.flush()
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pagehide", onPageExit)
    window.addEventListener("keydown", onSaveShortcut)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pagehide", onPageExit)
      window.removeEventListener("keydown", onSaveShortcut)

      controllerRef.current = null

      controller.dispose()
    }

    function onPageExit() {
      void controller.flush()
    }
  }, [commit])

  // A note on its way out must stop saving itself: the draft is discarded
  // rather than written after the delete has already landed.
  useEffect(() => {
    if (!autosaveAbandoned) {
      return
    }

    controllerRef.current?.abandon()
  }, [autosaveAbandoned])

  const edit = useCallback((changes: Partial<NoteDraft>) => {
    revisionRef.current += 1

    setDraft((current) => {
      const next = { ...current, ...changes }

      draftRef.current = next

      return next
    })

    setStatus("dirty")
    controllerRef.current?.schedule()
  }, [])

  const flush = useCallback(() => {
    void controllerRef.current?.flush()
  }, [])

  return { draft, status, saveError, edit, flush }
}