"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"

import type { WorkspaceView } from "@/components/providers/workspace-provider"
import { useWorkspaceActions } from "@/components/providers/workspace-provider"
import { NOTE_LIST_PATH } from "@/lib/notes/routes"

import { useShell } from "./shell-provider"

/**
 * Choosing a workspace normally changes state rather than route: the note list
 * is already on screen, and only what fills it has to change. That holds for
 * every screen except the phone's note screen, where the stylesheet takes the
 * list away to give the note the whole display. A press there would move the
 * active state and leave the note standing — a destination that announces
 * itself and goes nowhere.
 *
 * So the same choice travels the way Home travels when the list it would
 * switch is not there to switch: by route, with the view chosen first so the
 * workspace is what greets you at `/notes`. Whether the list is on screen is
 * the stylesheet's answer to give, never the viewport's, so the shell is asked
 * and no breakpoint is re-derived.
 */
export function useWorkspaceDestination(): (view: WorkspaceView) => void {
  const router = useRouter()
  const { isListOnScreen } = useShell()
  const { setView } = useWorkspaceActions()

  return useCallback(
    (view: WorkspaceView): void => {
      setView(view)

      if (!isListOnScreen()) {
        router.push(NOTE_LIST_PATH)
      }
    },
    [isListOnScreen, router, setView],
  )
}
