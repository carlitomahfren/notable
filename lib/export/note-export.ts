import { buildExport, type ExportableNote } from "@/lib/export/build-export"
import type { ExportFormatId } from "@/lib/export/export-formats"
import { saveBlob } from "@/lib/export/save-blob"

export type SaveFile = (blob: Blob, fileName: string) => void

/**
 * Exports a note in the chosen format.
 *
 * The save step is a parameter so the caller can be the browser or a test, and it is
 * the only step that touches the DOM. Building the file is asynchronous because two
 * of the formats load a library, which is also why the caller needs to be ready for
 * a moment where nothing has happened yet.
 */
export async function exportNote(
  format: ExportFormatId,
  note: ExportableNote,
  save: SaveFile = saveBlob,
): Promise<string> {
  const { blob, fileName } = await buildExport(format, note)

  save(blob, fileName)

  return fileName
}