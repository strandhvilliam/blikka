export function sanitizeFilenameSegment(value: string | null | undefined) {
  if (!value) {
    return "active-topic"
  }

  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
