"use client"

/** Best-effort download: blob when CORS allows, otherwise opens the URL in a new tab. */
export async function downloadRemoteUrl(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url, { method: "GET", mode: "cors" })
    if (!response.ok) {
      throw new Error("Bad response")
    }
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(objectUrl)
    return
  } catch {
    // S3 often blocks credentialed fetch; fall through.
  }

  const anchor = document.createElement("a")
  anchor.href = url
  anchor.target = "_blank"
  anchor.rel = "noopener noreferrer"
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}
