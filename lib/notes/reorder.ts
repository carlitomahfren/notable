/**
 * Puts an order into the shape every reader assumes: pinned notes first,
 * unpinned ones after them, and the order inside each region left exactly as it
 * was. The pinned region is only ever separated from the unpinned one by the
 * sort, so a sequence that lets an unpinned note lead a pinned one describes a
 * list that does not exist; this is the sequence that is written instead.
 *
 * Nothing is dropped or invented, so it is safe to run on an order that is
 * already correct, where it returns the same sequence as a new array.
 */
export function enforcePinnedFirst(
  orderedIds: readonly string[],
  pinnedIds: ReadonlySet<string>,
): string[] {
  const pinned = orderedIds.filter((id) => pinnedIds.has(id))
  const rest = orderedIds.filter((id) => !pinnedIds.has(id))

  return [...pinned, ...rest]
}

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