import { getExifDate, parseExifData, type ExifData } from "./exif-parsing"
import {
  byCameraThumbnailBreadcrumb,
  fileSummaryForSentry,
  serializeUnknownErrorForLog,
} from "./sentry-by-camera"

export const COMMON_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "heic",
  "heif",
  "png",
  "gif",
  "webp",
] as const

const CONTENT_TYPE_BY_EXTENSION = {
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const

const SUPPORTED_IMAGE_CONTENT_TYPES = new Set(
  Object.values(CONTENT_TYPE_BY_EXTENSION as Record<string, string>),
)

export interface NormalizedImageCandidate {
  file: File
  preconvertedExif: ExifData | null
}

export function createClientPhotoId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  )
}

export function isSupportedImageFile(
  file: File,
  supportedExtensions: readonly string[] = COMMON_IMAGE_EXTENSIONS,
): boolean {
  if (file.type.startsWith("image/")) {
    return true
  }

  const extension = file.name.split(".").pop()?.toLowerCase()
  return extension ? supportedExtensions.includes(extension) : false
}

export function resolveSelectedImageContentType(file: {
  type?: string | null
  name: string
}): (typeof CONTENT_TYPE_BY_EXTENSION)[keyof typeof CONTENT_TYPE_BY_EXTENSION] | null {
  const normalizedType = (file.type ?? "").trim().toLowerCase()

  if (normalizedType === "image/jpg") {
    return "image/jpeg"
  }

  if (SUPPORTED_IMAGE_CONTENT_TYPES.has(normalizedType)) {
    return normalizedType as (typeof CONTENT_TYPE_BY_EXTENSION)[keyof typeof CONTENT_TYPE_BY_EXTENSION]
  }

  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!extension) {
    return null
  }

  return CONTENT_TYPE_BY_EXTENSION[extension as keyof typeof CONTENT_TYPE_BY_EXTENSION] ?? null
}

const HEIC_CONVERSION_TIMEOUT_MS = 60_000

export async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const heic2any = await import("heic2any")

    const conversionPromise = heic2any.default({
      blob: file,
      toType: "image/jpeg",
      quality: 1,
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("HEIC conversion timed out")), HEIC_CONVERSION_TIMEOUT_MS)
    })

    const result = await Promise.race([conversionPromise, timeoutPromise])

    const blob = Array.isArray(result) ? result[0] : result
    if (!blob) {
      return null
    }

    return new File([blob], file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"), {
      type: "image/jpeg",
    })
  } catch (error) {
    console.error(`Failed to convert HEIC file ${file.name}:`, error)
    return null
  }
}

export async function normalizeSelectedImageFiles(
  files: File[],
  supportedExtensions: readonly string[] = COMMON_IMAGE_EXTENSIONS,
): Promise<{
  candidates: NormalizedImageCandidate[]
  warnings: string[]
}> {
  const warnings: string[] = []
  const candidates: NormalizedImageCandidate[] = []

  for (const file of files) {
    if (!isSupportedImageFile(file, supportedExtensions)) {
      warnings.push(`${file.name}: unsupported file type`)
      continue
    }

    if (!isHeicFile(file)) {
      candidates.push({
        file,
        preconvertedExif: null,
      })
      continue
    }

    const preconvertedExif = await parseExifData(file)
    const converted = await convertHeicToJpeg(file)

    if (!converted) {
      warnings.push(`${file.name}: failed to convert HEIC/HEIF`)
      continue
    }

    candidates.push({
      file: converted,
      preconvertedExif,
    })
  }

  return { candidates, warnings }
}

export function filterDuplicateImageCandidates(
  candidates: NormalizedImageCandidate[],
  existingFileNames: Iterable<string>,
): {
  uniqueCandidates: NormalizedImageCandidate[]
  duplicateFileNames: string[]
} {
  const seenExisting = new Set(Array.from(existingFileNames, (name) => name.toLowerCase()))
  const seenNew = new Set<string>()
  const duplicateFileNames: string[] = []

  const uniqueCandidates = candidates.filter((candidate) => {
    const normalizedName = candidate.file.name.toLowerCase()

    if (seenExisting.has(normalizedName) || seenNew.has(normalizedName)) {
      duplicateFileNames.push(candidate.file.name)
      return false
    }

    seenNew.add(normalizedName)
    return true
  })

  return { uniqueCandidates, duplicateFileNames }
}

export function limitImageCandidates<T>(
  candidates: T[],
  maxCount: number,
): {
  acceptedCandidates: T[]
  truncatedCount: number
} {
  const acceptedCandidates = candidates.slice(0, Math.max(0, maxCount))
  const truncatedCount = Math.max(0, candidates.length - acceptedCandidates.length)

  return {
    acceptedCandidates,
    truncatedCount,
  }
}

export function sortByExifDate<T>(
  items: T[],
  getExif: (item: T) => ExifData | null | undefined,
): T[] {
  return [...items].sort((a, b) => {
    const aDate = getExifDate(getExif(a))
    const bDate = getExifDate(getExif(b))

    if (!aDate && !bDate) return 0
    if (!aDate) return 1
    if (!bDate) return -1

    return aDate.getTime() - bDate.getTime()
  })
}

export function reassignOrderIndexes<T>(
  items: T[],
  topicOrderIndexes: number[],
  updater: (item: T, orderIndex: number) => T,
): T[] {
  return items.map((item, index) => updater(item, topicOrderIndexes[index] ?? index))
}

export function revokePreviewUrls<T>(items: T[], getUrl: (item: T) => string | null | undefined) {
  items.forEach((item) => {
    const url = getUrl(item)
    if (url) {
      URL.revokeObjectURL(url)
    }
  })
}

const THUMBNAIL_MAX_DIMENSION = 400

/** Extra attempts after the first when preview falls back to the raw file URL (flaky Android decoders). */
const PREVIEW_GENERATION_EXTRA_ATTEMPTS = 4
const PREVIEW_GENERATION_RETRY_DELAY_MS = 100

export type GenerateThumbnailUrlResult = {
  url: string
  /** All resize/decode strategies failed; preview uses `URL.createObjectURL(file)` — often breaks in `<img>` on huge files. */
  usedRawFileFallback: boolean
}

async function imageBitmapToJpegObjectUrl(bitmap: ImageBitmap): Promise<string> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    byCameraThumbnailBreadcrumb("fallback_no_2d_context", {
      w: bitmap.width,
      h: bitmap.height,
    })
    bitmap.close()
    throw new Error("no_2d_context")
  }

  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const blob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: 0.7,
  })
  byCameraThumbnailBreadcrumb("jpeg_thumbnail", {
    thumbBytes: blob.size,
    via: "create_image_bitmap",
  })
  return URL.createObjectURL(blob)
}

/**
 * decode path used when createImageBitmap fails (common for huge JPEGs on Android Chrome).
 */
async function generateThumbnailUrlViaImageElement(
  file: File | Blob,
  maxDimension: number,
): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.decoding = "async"
      image.onload = () => resolve(image)
      image.onerror = () =>
        reject(
          new Error(
            "img_onerror_after_load_start (browser does not expose decoder details for blob URLs)",
          ),
        )
      image.src = objectUrl
    })

    if ("decode" in img && typeof img.decode === "function") {
      try {
        await img.decode()
      } catch (decodeErr) {
        byCameraThumbnailBreadcrumb("image_element_decode_failed", {
          error: serializeUnknownErrorForLog(decodeErr),
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          maxDimension,
          file: fileSummaryForSentry(file),
        })
        return null
      }
    }

    const scale = Math.min(maxDimension / img.naturalWidth, maxDimension / img.naturalHeight, 1)
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      byCameraThumbnailBreadcrumb("image_element_no_canvas_context", {
        thumbW: w,
        thumbH: h,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        file: fileSummaryForSentry(file),
      })
      return null
    }

    ctx.drawImage(img, 0, 0, w, h)
    let blob: Blob
    try {
      blob = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: 0.7,
      })
    } catch (convertErr) {
      byCameraThumbnailBreadcrumb("image_element_convert_to_blob_failed", {
        error: serializeUnknownErrorForLog(convertErr),
        thumbW: w,
        thumbH: h,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        file: fileSummaryForSentry(file),
      })
      return null
    }

    byCameraThumbnailBreadcrumb("jpeg_thumbnail", {
      thumbBytes: blob.size,
      via: "image_element",
    })
    return URL.createObjectURL(blob)
  } catch (cause) {
    byCameraThumbnailBreadcrumb("image_element_failed", {
      error: serializeUnknownErrorForLog(cause),
      maxDimension,
      file: fileSummaryForSentry(file),
    })
    return null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Decode using `source` bytes; `logContext` is only for Sentry metadata (e.g. original File name).
 */
async function decodeThumbnailFromSource(
  source: Blob,
  maxDimension: number,
  logContext: File | Blob,
): Promise<GenerateThumbnailUrlResult> {
  const resizeAttempts = [maxDimension, Math.min(maxDimension, 256), 128] as const

  let bitmap: ImageBitmap | null = null
  let lastBitmapError: unknown = null

  for (let attempt = 0; attempt < resizeAttempts.length; attempt++) {
    const dim = resizeAttempts[attempt]
    try {
      bitmap = await createImageBitmap(source, {
        resizeWidth: dim,
        resizeHeight: dim,
        resizeQuality: "medium",
        imageOrientation: "from-image",
      })
      lastBitmapError = null
      break
    } catch (err) {
      lastBitmapError = err
      bitmap = null
      byCameraThumbnailBreadcrumb("create_image_bitmap_failed", {
        attempt,
        resizeDim: dim,
        error: serializeUnknownErrorForLog(err),
        file: fileSummaryForSentry(logContext),
      })
    }
  }

  if (bitmap) {
    try {
      const url = await imageBitmapToJpegObjectUrl(bitmap)
      return { url, usedRawFileFallback: false }
    } catch (cause) {
      lastBitmapError = cause
      byCameraThumbnailBreadcrumb("bitmap_to_jpeg_failed", {
        error: serializeUnknownErrorForLog(cause),
        file: fileSummaryForSentry(logContext),
      })
    }
  }

  const viaImage = await generateThumbnailUrlViaImageElement(source, maxDimension)
  if (viaImage) return { url: viaImage, usedRawFileFallback: false }

  byCameraThumbnailBreadcrumb("fallback_after_exception", {
    note: "using_source_object_url_after_all_thumbnail_strategies",
    lastError: serializeUnknownErrorForLog(lastBitmapError),
    file: fileSummaryForSentry(logContext),
  })
  return { url: URL.createObjectURL(source), usedRawFileFallback: true }
}

/**
 * Single attempt: small JPEG blob URL when possible, otherwise raw object URL.
 * After failure on the original `File`, reads full bytes into a new `Blob` and tries again — fixes many Chrome Android `content://`-backed handles that decode inconsistently.
 */
export async function generateThumbnailUrlAsResult(
  file: File | Blob,
  maxDimension = THUMBNAIL_MAX_DIMENSION,
): Promise<GenerateThumbnailUrlResult> {
  const first = await decodeThumbnailFromSource(file, maxDimension, file)
  if (!first.usedRawFileFallback) return first

  URL.revokeObjectURL(first.url)

  try {
    const buffer = await file.arrayBuffer()
    const mime = file.type && file.type.length > 0 ? file.type : "image/jpeg"
    const fresh = new Blob([buffer], { type: mime })
    byCameraThumbnailBreadcrumb("thumbnail_retry_fresh_blob_from_array_buffer", {
      byteLength: buffer.byteLength,
      file: fileSummaryForSentry(file),
    })

    const second = await decodeThumbnailFromSource(fresh, maxDimension, file)
    if (!second.usedRawFileFallback) return second

    URL.revokeObjectURL(second.url)
    byCameraThumbnailBreadcrumb("fallback_uses_fresh_blob_object_url", {
      lastError: serializeUnknownErrorForLog(
        "Decode still failed after materializing bytes; preview URL uses in-memory Blob",
      ),
      file: fileSummaryForSentry(file),
    })
    return { url: URL.createObjectURL(fresh), usedRawFileFallback: true }
  } catch (e) {
    byCameraThumbnailBreadcrumb("thumbnail_array_buffer_copy_failed", {
      error: serializeUnknownErrorForLog(e),
      file: fileSummaryForSentry(file),
    })
    byCameraThumbnailBreadcrumb("fallback_after_exception", {
      note: "array_buffer_read_failed_using_file_object_url",
      file: fileSummaryForSentry(file),
    })
    return { url: URL.createObjectURL(file), usedRawFileFallback: true }
  }
}

/**
 * Re-run thumbnail generation when the implementation falls back to a raw file URL (common with flaky reads on Chrome Android).
 * Does not re-open the file picker — same `File`, new decode attempts.
 */
export async function generateThumbnailUrlWithRetries(
  file: File | Blob,
  maxDimension = THUMBNAIL_MAX_DIMENSION,
): Promise<string> {
  const maxAttempts = 1 + PREVIEW_GENERATION_EXTRA_ATTEMPTS
  let last: GenerateThumbnailUrlResult | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0 && last?.url) {
      URL.revokeObjectURL(last.url)
      byCameraThumbnailBreadcrumb("preview_generation_retry", {
        attemptIndex: attempt,
        maxAttempts,
        delayMs: PREVIEW_GENERATION_RETRY_DELAY_MS * attempt,
        file: fileSummaryForSentry(file),
      })
      await new Promise<void>((resolve) => {
        setTimeout(resolve, PREVIEW_GENERATION_RETRY_DELAY_MS * attempt)
      })
    }

    last = await generateThumbnailUrlAsResult(file, maxDimension)
    if (!last.usedRawFileFallback) break
  }

  return last!.url
}

/**
 * Generates a small thumbnail blob URL from a full-size image file.
 * Uses createImageBitmap with resize for efficient sub-sampled decoding
 * so the browser never needs to fully decode the original resolution.
 * Falls back to Image+canvas, then a direct object URL if thumbnail generation fails.
 */
export async function generateThumbnailUrl(
  file: File | Blob,
  maxDimension = THUMBNAIL_MAX_DIMENSION,
): Promise<string> {
  const r = await generateThumbnailUrlAsResult(file, maxDimension)
  return r.url
}
