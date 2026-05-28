import { format } from 'date-fns'

export function formatExposure(seconds: number): string {
  if (seconds >= 1) return `${seconds}s`
  const denom = Math.round(1 / seconds)
  return `1/${denom}s`
}

export function humanizeExifKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim()
}

export function formatCompactExifValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  if (key === 'ExposureTime' && typeof value === 'number') return formatExposure(value)
  if (key === 'FNumber' && typeof value === 'number') return `f/${value.toFixed(1)}`
  if (key === 'FocalLength' && typeof value === 'number') return `${value} mm`
  if ((key.includes('Date') || key.includes('Time')) && typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return format(parsed, 'MMM d, yyyy HH:mm:ss')
  }
  return String(value)
}
