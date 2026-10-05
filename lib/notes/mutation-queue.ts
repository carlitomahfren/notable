export interface MutationQueue {
  enqueue<T>(task: () => Promise<T>): Promise<T>
}

function settle(): void {}

/**
 * Serializes every mutation so only one runs at a time.
 * A failed task rejects its own caller but leaves the queue usable.
 */
export function createMutationQueue(): MutationQueue {
  let tail: Promise<unknown> = Promise.resolve()

  return {
    enqueue<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(task)

      tail = result.then(settle, settle)

      return result
    },
  }
}