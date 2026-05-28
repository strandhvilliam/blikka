import type { Submission, ValidationResult } from '@blikka/db'

const EXIF_CAPTURE_KEYS = ['DateTimeOriginal', 'CreateDate', 'ModifyDate'] as const

export function getExifRecord(exif: unknown): Record<string, unknown> {
  if (!exif || typeof exif !== 'object') return {}
  return exif as Record<string, unknown>
}

export function hasExifData(exif: unknown): boolean {
  return Object.keys(getExifRecord(exif)).length > 0
}

export function getSubmissionCaptureDate(submission: Submission): Date | null {
  const exifRecord = getExifRecord(submission.exif)
  for (const key of EXIF_CAPTURE_KEYS) {
    const raw = exifRecord[key]
    if (typeof raw === 'string' && raw) {
      const parsed = new Date(raw)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
  }
  return null
}

export function readExifString(exif: unknown, key: string): string | null {
  const raw = getExifRecord(exif)[key]
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string') return raw.trim() || null
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : null
  return null
}

export function readExifNumber(exif: unknown, key: string): number | null {
  const raw = getExifRecord(exif)[key]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export type ValidationState = 'none' | 'valid' | 'warning' | 'error'

export function summarizeValidationResults(results: ValidationResult[]) {
  const failed = results.filter((r) => r.outcome === 'failed')
  return {
    failed,
    passedCount: results.length - failed.length,
    hasErrors: failed.some((r) => r.severity === 'error'),
    hasWarnings: failed.some((r) => r.severity === 'warning'),
  }
}

export function getValidationState(results: ValidationResult[]): ValidationState {
  if (results.length === 0) return 'none'
  const { hasErrors, hasWarnings } = summarizeValidationResults(results)
  if (hasErrors) return 'error'
  if (hasWarnings) return 'warning'
  return 'valid'
}

export function formatRuleKey(ruleKey: string): string {
  return ruleKey.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
