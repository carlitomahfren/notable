export interface Note {
  readonly id: string
  title: string
  content: string
  readonly createdAt: string
  updatedAt: string
  isPinned: boolean
  tags: string[]
}

export type NoteInput = Pick<Note, "title" | "content" | "tags">

export type NoteUpdate = Partial<
  Pick<Note, "title" | "content" | "tags" | "isPinned">
>

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}