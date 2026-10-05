import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAutosaveController } from "@/lib/editor/autosave-controller"

/** Records each committed snapshot so ordering can be asserted. */
function createHarness(
  options: {
    delay?: number
    maxWait?: number
    /** Holds each commit open until the returned function releases it. */
    manual?: boolean
    failFirst?: boolean
  } = {},
) {
  const delay = options.delay ?? 100
  const maxWait = options.maxWait ?? 1_000
  /** Snapshots an attempt began with, in order. */
  const started: string[] = []
  /** Snapshots an attempt finished persisting, in order. */
  const committed: string[] = []
  const releases: Array<() => void> = []
  let draft = ""
  let persisted = ""
  let inFlight = 0
  let maxConcurrent = 0
  let attempt = 0

  const controller = createAutosaveController({
    delay,
    maxWait,
    isDirty: () => draft !== persisted,
    commit: async () => {
      attempt += 1
      maxConcurrent = Math.max(maxConcurrent, ++inFlight)

      const snapshot = draft

      started.push(snapshot)

      if (options.failFirst === true && attempt === 1) {
        inFlight -= 1
        throw new Error("storage unavailable")
      }

      if (options.manual === true) {
        await new Promise<void>((resolve) => releases.push(resolve))
      }

      committed.push(snapshot)
      persisted = snapshot
      inFlight -= 1
    },
  })

  return {
    controller,
    started,
    committed,
    releases,
    setDraft: (value: string) => {
      draft = value
    },
    get maxConcurrent() {
      return maxConcurrent
    },
  }
}

/** Drains the microtask queue so promise continuations run to completion. */
async function settle(times = 12): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve()
  }
}

/** Opens every currently gated commit and lets the queue settle. */
async function releaseAll(
  releases: Array<() => void>,
): Promise<void> {
  releases.splice(0).forEach((release) => release())
  await settle()
  await settle()
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("debounce", () => {
  it("does not persist before the delay elapses", async () => {
    const harness = createHarness()

    harness.setDraft("A")
    harness.controller.schedule()

    await vi.advanceTimersByTimeAsync(99)

    expect(harness.committed).toEqual([])
  })

  it("persists once the delay elapses", async () => {
    const harness = createHarness()

    harness.setDraft("A")
    harness.controller.schedule()

    await vi.advanceTimersByTimeAsync(100)

    expect(harness.committed).toEqual(["A"])
  })

  it("collapses rapid edits into a single write of the newest value", async () => {
    const harness = createHarness()

    for (const value of ["A", "AB", "ABC", "ABCD"]) {
      harness.setDraft(value)
      harness.controller.schedule()
      await vi.advanceTimersByTimeAsync(40)
    }

    await vi.advanceTimersByTimeAsync(100)

    expect(harness.committed).toEqual(["ABCD"])
  })

  it("resets the debounce window on every edit", async () => {
    const harness = createHarness({ delay: 100, maxWait: 10_000 })

    harness.setDraft("A")
    harness.controller.schedule()

    for (let tick = 0; tick < 5; tick += 1) {
      await vi.advanceTimersByTimeAsync(80)
      harness.setDraft("A".repeat(tick + 2))
      harness.controller.schedule()
    }

    await vi.advanceTimersByTimeAsync(99)
    expect(harness.committed).toEqual([])

    await vi.advanceTimersByTimeAsync(1)
    expect(harness.committed).toEqual(["AAAAAA"])
  })
})

describe("max wait", () => {
  it("persists during continuous typing instead of waiting indefinitely", async () => {
    const harness = createHarness({ delay: 100, maxWait: 500 })

    // Typing every 80ms means the debounce window never opens before 500ms.
    harness.setDraft("A")
    harness.controller.schedule()

    for (let index = 1; index <= 6; index += 1) {
      await vi.advanceTimersByTimeAsync(80)
      harness.setDraft("A".repeat(index + 1))
      harness.controller.schedule()
    }

    // t = 480, last edit scheduled. Debounce would not fire until 580ms.
    await vi.advanceTimersByTimeAsync(19)
    expect(harness.committed).toEqual([])

    // The max-wait window closes 500ms after the first pending edit.
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.committed).toEqual(["AAAAAAA"])
  })

  it("re-arms the max wait after a max-wait save", async () => {
    const harness = createHarness({ delay: 100, maxWait: 500 })

    harness.setDraft("A")
    harness.controller.schedule()

    for (let index = 1; index <= 6; index += 1) {
      await vi.advanceTimersByTimeAsync(80)
      harness.setDraft("A".repeat(index + 1))
      harness.controller.schedule()
    }

    await vi.advanceTimersByTimeAsync(20)
    expect(harness.committed).toEqual(["AAAAAAA"])

    // A new edit starts a fresh window, and the debounce can now win.
    await vi.advanceTimersByTimeAsync(60)
    harness.setDraft("B")
    harness.controller.schedule()

    await vi.advanceTimersByTimeAsync(99)
    expect(harness.committed).toEqual(["AAAAAAA"])

    await vi.advanceTimersByTimeAsync(1)
    expect(harness.committed).toEqual(["AAAAAAA", "B"])
  })
})

describe("race conditions", () => {
  it("never lets a stale snapshot land after a newer edit is persisted", async () => {
    const harness = createHarness({ delay: 10, manual: true })

    harness.setDraft("A")
    harness.controller.schedule()

    await vi.advanceTimersByTimeAsync(10)

    // The first attempt is in flight, holding the snapshot "A".
    expect(harness.started).toEqual(["A"])
    expect(harness.committed).toEqual([])

    // An edit lands while that attempt is still open.
    harness.setDraft("AB")
    harness.controller.schedule()
    await vi.advanceTimersByTimeAsync(10)
    await settle()

    // The newer edit must not start a competing attempt.
    expect(harness.started).toEqual(["A"])

    await releaseAll(harness.releases)

    // Only now does the controller run again, with the newest draft.
    expect(harness.started).toEqual(["A", "AB"])

    await releaseAll(harness.releases)

    expect(harness.committed).toEqual(["A", "AB"])
  })

  it("runs at most one attempt at a time", async () => {
    const harness = createHarness({ delay: 10, maxWait: 40, manual: true })

    for (const value of ["A", "AB", "ABC"]) {
      harness.setDraft(value)
      harness.controller.schedule()
      await vi.advanceTimersByTimeAsync(15)
      await settle()
    }

    expect(harness.maxConcurrent).toBe(1)
    expect(harness.started).toEqual(["A"])

    // Drain every queued attempt, releasing each as it opens.
    for (let round = 0; round < 4; round += 1) {
      await releaseAll(harness.releases)
    }

    expect(harness.maxConcurrent).toBe(1)
    expect(harness.started[harness.started.length - 1]).toBe("ABC")
    expect(harness.committed[harness.committed.length - 1]).toBe("ABC")
  })

  it("ends on the newest value after many mid-flight edits", async () => {
    const harness = createHarness({ delay: 10, manual: true })

    for (const value of ["A", "AB", "ABC", "ABCD"]) {
      harness.setDraft(value)
      harness.controller.schedule()
      await vi.advanceTimersByTimeAsync(12)
      await settle()
      await releaseAll(harness.releases)
    }

    await vi.advanceTimersByTimeAsync(50)
    await releaseAll(harness.releases)

    expect(harness.committed[harness.committed.length - 1]).toBe("ABCD")
  })
})

describe("failure handling", () => {
  it("leaves the controller usable after a failed attempt", async () => {
    const harness = createHarness({ delay: 10, failFirst: true })

    harness.setDraft("A")
    harness.controller.schedule()
    await vi.advanceTimersByTimeAsync(10)

    // The failed attempt persisted nothing, so the draft is still dirty.
    expect(harness.committed).toEqual([])

    harness.setDraft("AB")
    harness.controller.schedule()
    await vi.advanceTimersByTimeAsync(10)

    expect(harness.committed).toEqual(["AB"])
  })

  it("does not let a failure poison later saves", async () => {
    const harness = createHarness({ delay: 10 })

    harness.setDraft("A")
    harness.controller.schedule()
    await vi.advanceTimersByTimeAsync(10)
    await vi.advanceTimersByTimeAsync(10)

    expect(harness.committed).toEqual(["A"])
    expect(harness.controller.isPending()).toBe(false)
  })
})

describe("flush and dispose", () => {
  it("persists immediately and resolves", async () => {
    const harness = createHarness({ delay: 10_000 })

    harness.setDraft("A")
    harness.controller.schedule()

    await harness.controller.flush()

    expect(harness.committed).toEqual(["A"])
  })

  it("does nothing when there is nothing to save", async () => {
    const harness = createHarness()

    await harness.controller.flush()

    expect(harness.committed).toEqual([])
  })

  it("waits for an in-flight attempt before flushing the remainder", async () => {
    const harness = createHarness({ delay: 10, manual: true })

    harness.setDraft("A")
    harness.controller.schedule()
    await vi.advanceTimersByTimeAsync(10)

    expect(harness.started).toEqual(["A"])

    harness.setDraft("AB")

    const flushed = harness.controller.flush()

// Releasing attempt 1 lets the flush start the follow-up attempt; releasing
// that one lets flush itself resolve.
    await releaseAll(harness.releases)
    await releaseAll(harness.releases)
    await flushed

    expect(harness.started).toEqual(["A", "AB"])
    expect(harness.committed[harness.committed.length - 1]).toBe("AB")
  })

  it("performs a final flush on dispose so unmount loses nothing", async () => {
    const harness = createHarness({ delay: 10_000 })

    harness.setDraft("A")
    harness.controller.schedule()

    harness.controller.dispose()
    await vi.advanceTimersByTimeAsync(1)

    expect(harness.committed).toEqual(["A"])
  })

  it("ignores edits scheduled after dispose", async () => {
    const harness = createHarness({ delay: 10 })

    harness.controller.dispose()
    harness.setDraft("late")
    harness.controller.schedule()

    await vi.advanceTimersByTimeAsync(50)

    expect(harness.committed).toEqual([])
  })

  it("reports whether work is outstanding", async () => {
    const harness = createHarness({ delay: 10 })

    expect(harness.controller.isPending()).toBe(false)

    harness.setDraft("A")
    harness.controller.schedule()
    expect(harness.controller.isPending()).toBe(true)

    await vi.advanceTimersByTimeAsync(10)
    expect(harness.controller.isPending()).toBe(false)
  })
})

describe("abandon", () => {
  it("drops a scheduled save", async () => {
    const harness = createHarness({ delay: 10 })

    harness.setDraft("A")
    harness.controller.schedule()
    harness.controller.abandon()

    await vi.advanceTimersByTimeAsync(50)

    expect(harness.started).toEqual([])
    expect(harness.controller.isPending()).toBe(false)
  })

  it("ignores edits scheduled after abandoning", async () => {
    const harness = createHarness({ delay: 10 })

    harness.controller.abandon()
    harness.setDraft("late")
    harness.controller.schedule()

    await vi.advanceTimersByTimeAsync(50)

    expect(harness.committed).toEqual([])
  })

  it("cancels a flush that is waiting on an in-flight attempt", async () => {
    const harness = createHarness({ delay: 10, manual: true })

    harness.setDraft("A")
    harness.controller.schedule()
    await vi.advanceTimersByTimeAsync(10)

    expect(harness.started).toEqual(["A"])

    harness.setDraft("AB")

    const flushed = harness.controller.flush()
    harness.controller.abandon()

    await releaseAll(harness.releases)
    await flushed
    await settle()

    // Only the attempt already in flight ran; the queued one was dropped.
    expect(harness.started).toEqual(["A"])
    expect(harness.committed).toEqual(["A"])
  })

  it("survives unmounting without writing a discarded draft", async () => {
    const harness = createHarness({ delay: 10 })

    harness.setDraft("A")
    harness.controller.schedule()
    harness.controller.abandon()
    harness.controller.dispose()

    await vi.advanceTimersByTimeAsync(50)
    await settle()

    expect(harness.committed).toEqual([])
  })
})