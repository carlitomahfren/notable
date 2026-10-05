"use client"

import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import { useNotesActions } from "@/components/providers/notes-provider"
import { useShell } from "@/components/shell/shell-provider"
import { notePath } from "@/lib/notes/routes"

/**
 * Shared create flow: create a valid empty note, receive its generated ID,
 * navigate to it, and focus the title. No `/notes/new` route is involved.
 */
export function useCreateNote() {
  const router = useRouter()
  const { createNote } = useNotesActions()
  const { requestTitleFocus } = useShell()
  const [isCreating, setIsCreating] = useState(false)

  const createEmptyNote = useCallback(async () => {
    if (isCreating) {
      return
    }

    setIsCreating(true)

    try {
      const note = await createNote({ title: "", content: "", tags: [] })

      requestTitleFocus()
      router.push(notePath(note.id))
    } finally {
      setIsCreating(false)
    }
  }, [createNote, isCreating, requestTitleFocus, router])

  return { createEmptyNote, isCreating }
}