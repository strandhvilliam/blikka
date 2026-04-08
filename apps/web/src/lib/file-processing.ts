import { getExifDate, parseExifData, type ExifData } from "./exif-parsing"
import { byCameraThumbnailBreadcrumb } from "./sentry-by-camera"

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
      image.onerror = () => reject(new Error("img_decode_failed"))
      image.src = objectUrl
    })

    if ("decode" in img && typeof img.decode === "function") {
      try {
        await img.decode()
      } catch {
        return null
      }
    }

    const scale = Math.min(maxDimension / img.naturalWidth, maxDimension / img.naturalHeight, 1)
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.drawImage(img, 0, 0, w, h)
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.7,
    })
    byCameraThumbnailBreadcrumb("jpeg_thumbnail", {
      thumbBytes: blob.size,
      via: "image_element",
    })
    return URL.createObjectURL(blob)
  } catch (cause) {
    byCameraThumbnailBreadcrumb("image_element_failed", {
      cause: cause instanceof Error ? cause.message : String(cause),
    })
    return null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
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
  const resizeAttempts = [maxDimension, Math.min(maxDimension, 256), 128] as const

  let bitmap: ImageBitmap | null = null
  let lastBitmapError: unknown = null

  for (const dim of resizeAttempts) {
    try {
      bitmap = await createImageBitmap(file, {
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
    }
  }

  if (bitmap) {
    try {
      return await imageBitmapToJpegObjectUrl(bitmap)
    } catch (cause) {
      lastBitmapError = cause
    }
  }

  const viaImage = await generateThumbnailUrlViaImageElement(file, maxDimension)
  if (viaImage) return viaImage

  byCameraThumbnailBreadcrumb("fallback_after_exception", {
    cause:
      lastBitmapError instanceof Error
        ? lastBitmapError.message
        : lastBitmapError != null
          ? String(lastBitmapError)
          : "unknown",
  })
  return URL.createObjectURL(file)
}
