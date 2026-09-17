/** Safe to import in the browser. Keep bucket names as Blob pathname prefixes. */
export function buildBlobUrl(bucket: string, key: string): string | undefined {
  const base = process.env.NEXT_PUBLIC_BLOB_BASE_URL
  if (!base) return undefined
  const pathname = `${bucket}/${key}`.split('/').map(encodeURIComponent).join('/')
  return `${base.replace(/\/$/, '')}/${pathname}`
}
