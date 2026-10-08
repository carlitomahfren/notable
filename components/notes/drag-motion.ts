import {
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from "@dnd-kit/core"
import type { UseSortableArguments } from "@dnd-kit/sortable"

/*
 * The shape `useSortable` takes as its `transition`. The package declares it
 * under a name of its own but does not export it, so it is read back off the
 * hook's argument instead of being written out a second time.
 */
type RowTransition = NonNullable<UseSortableArguments["transition"]>

/*
 * The glide and the settle of one gesture, kept together so they cannot drift
 * apart.
 *
 * Both run on the app's own easing curve (`--ease-standard` in the stylesheet)
 * rather than the library's gentler `ease`, which starts slowly: rows beside a
 * dragged note have to begin moving as soon as the pointer does, or the gap a
 * note is headed for only opens once the note has arrived. The durations stay
 * inside the 150-250ms budget the rest of the interface keeps to.
 *
 * The page-wide reduced-motion rule flattens the CSS transition; the settle is a
 * Web Animation, which that rule cannot reach, so the list asks the preference
 * for this one itself.
 */

/** Rows sliding aside while a note travels over them. */
export const NOTE_ROW_TRANSITION: RowTransition = {
  duration: 160,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
}

/** The floating card settling into the row it lands in. */
export const NOTE_DROP_ANIMATION: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  /*
   * The source row is dimmed rather than hidden while it is being dragged, so
   * the copy in the air is the only card visible until it lands; then the row
   * takes the note back.
   */
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0" } },
  }),
}
