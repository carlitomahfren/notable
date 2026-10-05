"use client"

import { useEffect } from "react"

export default function NotesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="shell-editor shell-editor--empty" role="alert">
      <h1 className="shell-editor__title">Something went wrong</h1>
      <p className="shell-placeholder">
        The notes workspace hit an unexpected error.
      </p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </div>
  )
}