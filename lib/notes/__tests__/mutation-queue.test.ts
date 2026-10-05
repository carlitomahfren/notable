import { describe, expect, it } from "vitest"

import { createMutationQueue } from "@/lib/notes/mutation-queue"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe("createMutationQueue", () => {
  it("resolves with the task result", async () => {
    const queue = createMutationQueue()

    await expect(queue.enqueue(async () => "value")).resolves.toBe("value")
  })

  it("runs a single task", async () => {
    const queue = createMutationQueue()
    const order: string[] = []

    await queue.enqueue(async () => {
      order.push("ran")
    })

    expect(order).toEqual(["ran"])
  })

  it("runs tasks one at a time, in order", async () => {
    const queue = createMutationQueue()
    const order: string[] = []

    const task = (label: string, delay: number) => async () => {
      order.push(`start:${label}`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      order.push(`end:${label}`)
    }

    await Promise.all([
      queue.enqueue(task("a", 20)),
      queue.enqueue(task("b", 1)),
      queue.enqueue(task("c", 1)),
    ])

    expect(order).toEqual([
      "start:a",
      "end:a",
      "start:b",
      "end:b",
      "start:c",
      "end:c",
    ])
  })

  it("never overlaps two tasks even when enqueued together", async () => {
    const queue = createMutationQueue()
    let active = 0
    let maxActive = 0

    const task = async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
    }

    await Promise.all([
      queue.enqueue(task),
      queue.enqueue(task),
      queue.enqueue(task),
      queue.enqueue(task),
    ])

    expect(maxActive).toBe(1)
  })

  it("propagates a failure to its own caller", async () => {
    const queue = createMutationQueue()
    const failure = new Error("write failed")

    await expect(queue.enqueue(async () => Promise.reject(failure))).rejects.toBe(
      failure,
    )
  })

  it("keeps running later tasks after a failure", async () => {
    const queue = createMutationQueue()
    const order: string[] = []

    const failing = queue.enqueue(async () => {
      order.push("failing")
      throw new Error("boom")
    })
    const following = queue.enqueue(async () => {
      order.push("following")
      return "ok"
    })

    await expect(failing).rejects.toThrow("boom")
    await expect(following).resolves.toBe("ok")
    expect(order).toEqual(["failing", "following"])
  })

  it("stays usable after repeated failures", async () => {
    const queue = createMutationQueue()

    await expect(
      queue.enqueue(async () => {
        throw new Error("one")
      }),
    ).rejects.toThrow("one")
    await expect(
      queue.enqueue(async () => {
        throw new Error("two")
      }),
    ).rejects.toThrow("two")

    await expect(queue.enqueue(async () => "still works")).resolves.toBe(
      "still works",
    )
  })

  it("does not let a failure block tasks enqueued after it", async () => {
    const queue = createMutationQueue()
    const order: string[] = []

    const results = await Promise.allSettled([
      queue.enqueue(async () => {
        order.push("first")
        throw new Error("nope")
      }),
      queue.enqueue(async () => {
        order.push("second")
        return 2
      }),
      queue.enqueue(async () => {
        order.push("third")
        return 3
      }),
    ])

    expect(results.map((result) => result.status)).toEqual([
      "rejected",
      "fulfilled",
      "fulfilled",
    ])
    expect(order).toEqual(["first", "second", "third"])
  })

  it("does not start the next task until the current one settles", async () => {
    const queue = createMutationQueue()
    const gate = deferred<void>()
    const order: string[] = []

    const first = queue.enqueue(async () => {
      order.push("first:start")
      await gate.promise
      order.push("first:end")
    })
    const second = queue.enqueue(async () => {
      order.push("second")
    })

    await Promise.resolve()
    expect(order).toEqual(["first:start"])

    gate.resolve()
    await Promise.all([first, second])

    expect(order).toEqual(["first:start", "first:end", "second"])
  })

  it("supports distinct result types across sequential tasks", async () => {
    const queue = createMutationQueue()

    const note = await queue.enqueue(async () => ({ id: "1" }))
    const count = await queue.enqueue(async () => 2)

    expect(note).toEqual({ id: "1" })
    expect(count).toBe(2)
  })

  it("returns the same value for repeated reads enqueued together", async () => {
    const queue = createMutationQueue()
    const results = await Promise.all([
      queue.enqueue(async () => 1),
      queue.enqueue(async () => 1),
      queue.enqueue(async () => 1),
    ])

    expect(results).toEqual([1, 1, 1])
  })
})