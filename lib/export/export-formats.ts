/**
 * The formats a note can leave the app in, in the order they are offered.
 *
 * Text and Markdown are first because they are lossless and instant. PDF and Word
 * are last because each one builds a document in the browser: they are the only
 * formats here that need a library, and they are loaded only when asked for.
 */
export const EXPORT_FORMATS = [
  {
    id: "txt",
    label: "Plain text",
    extension: "txt",
    mediaType: "text/plain;charset=utf-8",
    /** Lossless without a library, so it does not load anything. */
    needsLibrary: false,
  },
  {
    id: "md",
    label: "Markdown",
    extension: "md",
    mediaType: "text/markdown;charset=utf-8",
    needsLibrary: false,
  },
  {
    id: "pdf",
    label: "PDF",
    extension: "pdf",
    mediaType: "application/pdf",
    needsLibrary: true,
  },
  {
    id: "docx",
    label: "Word document",
    extension: "docx",
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    needsLibrary: true,
  },
] as const

export type ExportFormatId = (typeof EXPORT_FORMATS)[number]["id"]

export interface ExportFormat {
  readonly id: ExportFormatId
  readonly label: string
  readonly extension: string
  readonly mediaType: string
  readonly needsLibrary: boolean
}

export function exportFormat(id: ExportFormatId): ExportFormat {
  const format = EXPORT_FORMATS.find((candidate) => candidate.id === id)

  if (format === undefined) {
    throw new Error(`unknown export format: ${id}`)
  }

  return format
}