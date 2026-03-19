"use client"

export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { method: "GET" })

  if (!response.ok) {
    throw new Error("Export failed")
  }

  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = downloadUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  window.URL.revokeObjectURL(downloadUrl)
  document.body.removeChild(anchor)
}
