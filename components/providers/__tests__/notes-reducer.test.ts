import { describe, expect, it } from "vitest"

import {
  initialNotesState,
  notesReducer,
  type NotesState,
} from "@/components/providers/notes-reducer"
import { makeNote } from "@/lib/notes/__tests__/note-factory"

function loadedState(notes = [] as ReturnType<typeof makeNote>[]): NotesState {
  return notesReducer(initialNotesState, { type: "loadSucceeded", notes })
}

describe("initialNotesState", () => {
  it("starts in a loading status with no notes and no errors", () => {
    expect(initialNotesState).toEqual({
      status: "loading",
      notes: [],
      loadError: null,
      mutationError: null,
    })
  })

  it("matches between calls, keeping server and client first render identical", () => {
    expect(initialNotesState).toEqual(initialNotesState)
  })
})

describe("notesReducer load transitions", () => {
  it("becomes ready with the loaded notes", () => {
    const note = makeNote()
    const state = notesReducer(initialNotesState, {
      type: "loadSucceeded",
      notes: [note],
    })

    expect(state.status).toBe("ready")
    expect(state.notes).toEqual([note])
    expect(state.loadError).toBeNull()
  })

  it("becomes an error status and records the load error", () => {
    const error = new Error("storage unavailable")
    const state = notesReducer(initialNotesState, {
      type: "loadFailed",
      error,
    })

    expect(state.status).toBe("error")
    expect(state.loadError).toBe(error)
    expect(state.notes).toEqual([])
  })

  it("keeps previously loaded notes when a load fails", () => {
    const note = makeNote()
    const ready = loadedState([note])
    const state = notesReducer(ready, {
      type: "loadFailed",
      error: new Error("boom"),
    })

    expect(state.status).toBe("error")
    expect(state.notes).toEqual([note])
  })

  it("returns to loading and clears the load error on retry", () => {
    const errored = notesReducer(initialNotesState, {
      type: "loadFailed",
      error: new Error("boom"),
    })

    const state = notesReducer(errored, { type: "loadStarted" })

    expect(state.status).toBe("loading")
    expect(state.loadError).toBeNull()
  })

  it("keeps existing notes while retrying", () => {
    const note = makeNote()
    const state = notesReducer(loadedState([note]), { type: "loadStarted" })

    expect(state.notes).toEqual([note])
  })

  it("recovers to ready on a successful retry", () => {
    const note = makeNote()
    const errored = notesReducer(initialNotesState, {
      type: "loadFailed",
      error: new Error("boom"),
    })
    const loading = notesReducer(errored, { type: "loadStarted" })
    const state = notesReducer(loading, {
      type: "loadSucceeded",
      notes: [note],
    })

    expect(state.status).toBe("ready")
    expect(state.loadError).toBeNull()
    expect(state.notes).toEqual([note])
  })

  it("replaces notes on a successful reload", () => {
    const first = makeNote()
    const second = makeNote()
    const state = notesReducer(loadedState([first]), {
      type: "loadSucceeded",
      notes: [second],
    })

    expect(state.notes).toEqual([second])
  })
})

describe("notesReducer mutation transitions", () => {
  it("appends a created note", () => {
    const note = makeNote()
    const state = notesReducer(loadedState(), {
      type: "noteUpserted",
      note,
    })

    expect(state.notes).toEqual([note])
    expect(state.status).toBe("ready")
  })

  it("replaces an existing note on update", () => {
    const note = makeNote({ title: "Original" })
    const state = notesReducer(loadedState([note]), {
      type: "noteUpserted",
      note: { ...note, title: "Renamed" },
    })

    expect(state.notes).toHaveLength(1)
    expect(state.notes[0].title).toBe("Renamed")
  })

  it("preserves note order when replacing", () => {
    const first = makeNote()
    const second = makeNote()
    const state = notesReducer(loadedState([first, second]), {
      type: "noteUpserted",
      note: { ...first, title: "Renamed" },
    })

    expect(state.notes.map((note) => note.id)).toEqual([first.id, second.id])
  })

  it("removes a deleted note", () => {
    const first = makeNote()
    const second = makeNote()
    const state = notesReducer(loadedState([first, second]), {
      type: "noteDeleted",
      id: first.id,
    })

    expect(state.notes).toEqual([second])
  })

  it("ignores a delete for an unknown id", () => {
    const note = makeNote()
    const state = notesReducer(loadedState([note]), {
      type: "noteDeleted",
      id: "unknown",
    })

    expect(state.notes).toEqual([note])
  })

  it("records a mutation error without changing status", () => {
    const note = makeNote()
    const error = new Error("save failed")
    const state = notesReducer(loadedState([note]), {
      type: "mutationFailed",
      error,
    })

    expect(state.mutationError).toBe(error)
    expect(state.status).toBe("ready")
    expect(state.notes).toEqual([note])
    expect(state.loadError).toBeNull()
  })

  it("does not change notes on a failed mutation", () => {
    const note = makeNote()
    const state = notesReducer(loadedState([note]), {
      type: "mutationFailed",
      error: new Error("save failed"),
    })

    expect(state.notes).toEqual([note])
  })

  it("clears the mutation error", () => {
    const errored = notesReducer(loadedState(), {
      type: "mutationFailed",
      error: new Error("save failed"),
    })

    const state = notesReducer(errored, { type: "mutationErrorCleared" })

    expect(state.mutationError).toBeNull()
  })

  it("leaves the mutation error untouched by a load", () => {
    const errored = notesReducer(loadedState(), {
      type: "mutationFailed",
      error: new Error("save failed"),
    })

    const state = notesReducer(errored, { type: "loadSucceeded", notes: [] })

    expect(state.mutationError).toBe(errored.mutationError)
  })

  it("does not mutate the previous state object", () => {
    const note = makeNote()
    const before = loadedState([note])

    notesReducer(before, { type: "noteUpserted", note: makeNote() })
    notesReducer(before, { type: "noteDeleted", id: note.id })

    expect(before.notes).toEqual([note])
  })

  it("replaces notes in the requested order on reorder", () => {
    const first = makeNote()
    const second = makeNote()
    const third = makeNote()
    const state = notesReducer(loadedState([first, second, third]), {
      type: "notesReordered",
      notes: [third, first, second],
    })

    expect(state.notes.map((note) => note.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ])
    expect(state.status).toBe("ready")
  })

  it("does not mutate the previous state on reorder", () => {
    const first = makeNote()
    const second = makeNote()
    const before = loadedState([first, second])

    notesReducer(before, { type: "notesReordered", notes: [second, first] })

    expect(before.notes).toEqual([first, second])
  })

  it("does not mutate the notes array passed to loadSucceeded", () => {
    const notes = [makeNote()]
    const state = notesReducer(initialNotesState, {
      type: "loadSucceeded",
      notes,
    })

    notes.push(makeNote())

    expect(state.notes).toHaveLength(1)
  })
})