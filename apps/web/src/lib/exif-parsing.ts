import { Effect } from 'effect'
import { ExifParser } from '@blikka/image-manipulation/exif-parser'
import { clientRuntime } from './client-runtime'

export type ExifData = Record<string, unknown>

export async function parseExifData(file: File): Promise<ExifData | null> {
  try {
    const buffer = await file.arrayBuffer()
    const tags = await clientRuntime.runPromise(
      Effect.gen(function* () {
        const parser = yield* ExifParser
        return yield* parser.parse(new Uint8Array(buffer))
      }),
    )

    return tags as ExifData
  } catch {
    return null
  }
}

export function getCapturedAtDate(exif?: ExifData | null): Date | null {
  if (!exif) {
    return null
  }

  const dateValue = exif.DateTimeOriginal ?? exif.DateTimeDigitized ?? exif.CreateDate
  if (typeof dateValue !== 'string' && !(dateValue instanceof Date)) {
    return null
  }

  const date = new Date(dateValue)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Uses the same capture-time fields as reorder detection and EXIF sorting. */
export function getExifDate(exif?: ExifData | null): Date | null {
  return getCapturedAtDate(exif)
}

/** The subset of EXIF tags surfaced in the photo details tables. */
export function getRelevantExifData(exif?: ExifData | null): Record<string, string> {
  const relevantData: Record<string, string> = {}
  if (!exif) return relevantData

  if (exif.Make && typeof exif.Make === 'string') relevantData['Camera Make'] = exif.Make
  if (exif.Model && typeof exif.Model === 'string') relevantData['Camera Model'] = exif.Model

  if (exif.ExposureTime && typeof exif.ExposureTime === 'number') {
    const exposureValue = exif.ExposureTime
    relevantData['Exposure'] =
      exposureValue < 1 ? `1/${Math.round(1 / exposureValue)}s` : `${exposureValue}s`
  }

  if (exif.FNumber && typeof exif.FNumber === 'number')
    relevantData['Aperture'] = `f/${exif.FNumber}`

  if (exif.ISO && (typeof exif.ISO === 'number' || typeof exif.ISO === 'string'))
    relevantData['ISO'] = `ISO ${exif.ISO}`

  if (exif.FocalLength && typeof exif.FocalLength === 'number')
    relevantData['Focal Length'] = `${exif.FocalLength}mm`

  const capturedAt = getCapturedAtDate(exif)
  if (capturedAt) {
    relevantData['Date Taken'] = capturedAt.toLocaleDateString()
    relevantData['Time Taken'] = capturedAt.toLocaleTimeString()
  }

  if (exif.LensModel && typeof exif.LensModel === 'string') relevantData['Lens'] = exif.LensModel

  if (
    exif.latitude &&
    exif.longitude &&
    typeof exif.latitude === 'number' &&
    typeof exif.longitude === 'number'
  ) {
    relevantData['GPS'] = `${exif.latitude.toFixed(6)}, ${exif.longitude.toFixed(6)}`
  }

  return relevantData
}
