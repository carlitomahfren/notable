export const NOTE_LIST_PATH = "/notes"

/** The landing destination: a small dashboard that points at the workspace. */
export const HOME_PATH = "/"

export function notePath(noteId: string): string {
  return `${NOTE_LIST_PATH}/${noteId}`
}

/**
 * Resolves the selected note from the URL. The selected note is never
 * duplicated into global state, so this is the single source of truth.
 */
export function selectedNoteIdFromPathname(pathname: string): string | null {
  if (!pathname.startsWith(`${NOTE_LIST_PATH}/`)) {
    return null
  }

  const noteId = pathname.slice(NOTE_LIST_PATH.length + 1)

  return noteId === "" ? null : noteId
}