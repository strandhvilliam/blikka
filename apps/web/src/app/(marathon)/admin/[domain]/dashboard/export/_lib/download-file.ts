'use client'

/**
 * Export routes answer failures with `{ error, details }` — a too-large jury archive says which
 * scope to take instead, and a locked export says why. Dropping that on the floor and reporting a
 * bare "Export failed" would leave the organizer with nothing to act on.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; details?: string }
    return body.details ?? body.error ?? 'Export failed'
  } catch {
    return 'Export failed'
  }
}

export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { method: 'GET' })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = downloadUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  window.URL.revokeObjectURL(downloadUrl)
  document.body.removeChild(anchor)
}
