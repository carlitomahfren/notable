import { NotesShell } from "@/components/shell/notes-shell"
import { ShellProvider } from "@/components/shell/shell-provider"

export default function NotesLayout({ children }: LayoutProps<"/notes">) {
  return (
    <ShellProvider>
      <NotesShell>{children}</NotesShell>
    </ShellProvider>
  )
}