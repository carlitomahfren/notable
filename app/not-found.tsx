import Link from "next/link"

export default function NotFound() {
  return (
    <div className="shell-editor shell-editor--empty">
      <h1 className="shell-editor__title">Page not found</h1>
      <p className="shell-placeholder">
        The page you are looking for does not exist.
      </p>
      <Link href="/notes" className="shell-return-link">
        Back to notes
      </Link>
    </div>
  )
}