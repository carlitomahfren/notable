import type { WorkspaceView } from "@/components/providers/workspace-provider"

/**
 * Compares two workspace views so the top navigation and the mobile bottom bar
 * always agree on which destination is current.
 *
 * The Tags workspace and a single tag are the same destination: picking a tag
 * from the workspace's own filter keeps the navigation on Tags, because the
 * page the user is on is still the Tags workspace.
 */
export function isViewActive(
  current: WorkspaceView,
  candidate: WorkspaceView,
): boolean {
  if (current.kind === "tag" && candidate.kind === "tag") {
    return current.tag === candidate.tag
  }

  const isTagsDestination =
    (current.kind === "tags" || current.kind === "tag") &&
    (candidate.kind === "tags" || candidate.kind === "tag")

  if (isTagsDestination) {
    return true
  }

  return current.kind === candidate.kind
}