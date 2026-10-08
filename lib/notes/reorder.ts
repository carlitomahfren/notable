/**
 * Converts a move inside a filtered slice of the list (drags can only happen
 * between the notes that are visible) into an order for the full list.
 *
 * The notes the user cannot see keep their relative order untouched; the moved
 * note is placed immediately after the note that precedes it in the reordered
 * slice, or at the front when it leads the slice. In the all-notes view, where
 * every note is visible, this is exactly the reorder the user asked for.
 */
export function projectVisibleReorderToFull(
  fullOrder: readonly string[],
  reorderedVisible: readonly string[],
  movedId: string,
): string[] {
  const movedIndex = reorderedVisible.indexOf(movedId)

  if (movedIndex === -1) {
    return [...fullOrder]
  }

  const predecessor = reorderedVisible[movedIndex - 1]
  const rest = fullOrder.filter((id) => id !== movedId)

  if (predecessor === undefined) {
    return [movedId, ...rest]
  }

  const insertAt = rest.indexOf(predecessor)

  if (insertAt === -1) {
    return [...fullOrder]
  }

  const next = [...rest]
  next.splice(insertAt + 1, 0, movedId)

  return next
}