import type { WorkspaceView } from "@/components/providers/workspace-provider"

/**
 * Compares two workspace views so the top navigation and the mobile bottom bar
 * always agree on which destination is current.
 */
export function isViewActive(
  current: WorkspaceView,
  candidate: WorkspaceView,
): boolean {
  if (current.kind !== candidate.kind) {
    return false
  }

  if (current.kind === "tag" && candidate.kind === "tag") {
    return current.tag === candidate.tag
  }

  return true
}