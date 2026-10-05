export const AUTOSAVE_DELAY_MS = 800
export const AUTOSAVE_MAX_WAIT_MS = 5_000

export interface AutosaveController {
  /** Marks the draft dirty and (re)starts the debounce window. */
  schedule: () => void
  /** Persists immediately when dirty, awaiting any in-flight attempt. */
  flush: () => Promise<void>
  /**
   * Drops every pending save without persisting. Used when the target note is
   * being deleted, so a draft is never written to a note that is going away.
   */
  abandon: () => void
  /** Stops all timers and performs a final non-blocking flush. */
  dispose: () => void
  /** True while an attempt is running or waiting to run. */
  isPending: () => boolean
}

export interface AutosaveControllerOptions {
  delay: number
  maxWait: number
  /** Whether the draft differs from the last persisted snapshot. */
  isDirty: () => boolean
  /** Performs one persistence attempt and settles its own status reporting. */
  commit: () => Promise<void>
}

/**
 * Debounces persistence and guarantees at most one attempt runs at a time.
 *
 * Only one attempt is ever in flight, and every attempt re-reads the latest
 * draft when it starts. A stale snapshot therefore cannot be committed after a
 * newer edit: if edits land mid-attempt the controller runs again afterwards
 * instead of trusting the completed attempt. A failed attempt leaves the draft
 * dirty and the controller usable.
 */
export function createAutosaveController({
  delay,
  maxWait,
  isDirty,
  commit,
}: AutosaveControllerOptions): AutosaveController {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<void> | undefined
  let runAgain = false
  let disposed = false
  let abandoned = false

  const clearTimers = (): void => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
      debounceTimer = undefined
    }

    if (maxWaitTimer !== undefined) {
      clearTimeout(maxWaitTimer)
      maxWaitTimer = undefined
    }
  }

  const run = async (): Promise<void> => {
    clearTimers()

    if (abandoned || !isDirty()) {
      return
    }

    if (inFlight !== undefined) {
      runAgain = true
      return
    }

    // Wrapping keeps a synchronous throw inside commit from escaping the
    // controller, so one bad attempt can never break the schedule.
    const attempt = (async () => commit())()

    inFlight = attempt.then(
      () => undefined,
      () => undefined,
    )

    await inFlight

    if (inFlight !== undefined) {
      inFlight = undefined
    }

    // Abandoning mid-attempt also cancels the queued follow-up.
    if (abandoned) {
      runAgain = false
      return
    }

    if (runAgain) {
      runAgain = false
      await run()
    }
  }

  const schedule = (): void => {
    if (disposed || abandoned) {
      return
    }

    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      void run()
    }, delay)

    // The max-wait window is measured from the first pending edit, so a
    // continuous typist still reaches storage.
    if (maxWaitTimer === undefined) {
      maxWaitTimer = setTimeout(() => {
        maxWaitTimer = undefined
        void run()
      }, maxWait)
    }
  }

  const flush = async (): Promise<void> => {
    clearTimers()

    if (abandoned) {
      return
    }

    if (inFlight !== undefined) {
      await inFlight
      runAgain = false
    }

    await run()
  }

  const abandon = (): void => {
    abandoned = true
    runAgain = false
    clearTimers()
  }

  const dispose = (): void => {
    clearTimers()
    disposed = true
    void run()
  }

  return {
    schedule,
    flush,
    abandon,
    dispose,
    isPending: () =>
      inFlight !== undefined ||
      debounceTimer !== undefined ||
      maxWaitTimer !== undefined,
  }
}