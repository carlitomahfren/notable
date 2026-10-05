/**
 * Hands a built file to the browser.
 *
 * There is no way to write a file from JavaScript, so the only route a page has is
 * a link to a `blob:` URL with a download name, clicked. The object URL is revoked
 * on the next turn of the event loop rather than immediately: revoking it in the
 * same statement can cancel the download in some browsers before it has started.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  link.rel = "noopener"
  link.style.display = "none"

  document.body.append(link)
  link.click()
  link.remove()

  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}