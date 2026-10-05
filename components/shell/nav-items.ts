import { NotebookPen, Pin } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { WorkspaceView } from "@/components/providers/workspace-provider"

export interface ViewNavItem {
  readonly key: string
  readonly label: string
  readonly view: WorkspaceView
  readonly Icon: LucideIcon
}

/**
 * Shared definition for the two real workspace destinations. The desktop top
 * navigation and the mobile bottom bar both read from this list so the icons,
 * labels, and order cannot drift apart.
 */
export const VIEW_NAV_ITEMS: readonly ViewNavItem[] = [
  { key: "all", label: "All Notes", view: { kind: "all" }, Icon: NotebookPen },
  { key: "pinned", label: "Pinned", view: { kind: "pinned" }, Icon: Pin },
]