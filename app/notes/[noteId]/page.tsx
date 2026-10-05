import { NoteDetailView } from "./note-detail-view"

export default async function NotePage({
  params,
}: PageProps<"/notes/[noteId]">) {
  const { noteId } = await params

  return <NoteDetailView noteId={noteId} />
}