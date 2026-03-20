import type {
  ParticipantSelectedPhoto,
  ProcessSelectedFilesResult,
} from "./participant-upload-types"
import { type ExifData, parseExifData } from "./exif-parsing"
import {
  COMMON_IMAGE_EXTENSIONS,
  createClientPhotoId,
  filterDuplicateImageCandidates,
  generateThumbnailUrl,
  limitImageCandidates,
  normalizeSelectedImageFiles,
  reassignOrderIndexes,
  sortByExifDate,
  type NormalizedImageCandidate,
} from "./file-processing"

interface ProcessSelectedFilesInput {
  fileList: FileList | File[] | null
  existingPhotos: ParticipantSelectedPhoto[]
  maxPhotos: number
  topicOrderIndexes: number[]
}

interface PrepareParticipantSelectedPhotosInput {
  candidates: NormalizedImageCandidate[]
  existingPhotos: ParticipantSelectedPhoto[]
  maxPhotos: number
  topicOrderIndexes: number[]
}

async function createParticipantSelectedPhoto(candidate: {
  file: File
  preconvertedExif: ExifData | null
}): Promise<ParticipantSelectedPhoto> {
  const [parsedExif, previewUrl] = await Promise.all([
    candidate.preconvertedExif
      ? Promise.resolve(candidate.preconvertedExif)
      : parseExifData(candidate.file),
    generateThumbnailUrl(candidate.file),
  ])

  return {
    id: createClientPhotoId(),
    file: candidate.file,
    exif: candidate.preconvertedExif || parsedExif || {},
    preconvertedExif: candidate.preconvertedExif,
    previewUrl,
    orderIndex: 0,
  }
}

export async function prepareParticipantSelectedPhotos({
  candidates,
  existingPhotos,
  maxPhotos,
  topicOrderIndexes,
}: PrepareParticipantSelectedPhotosInput): Promise<ProcessSelectedFilesResult> {
  const errors: string[] = []
  const warnings: string[] = []

  if (candidates.length === 0) {
    return {
      photos: existingPhotos,
      warnings,
      errors: ["No valid image files available"],
    }
  }

  const { uniqueCandidates, duplicateFileNames } = filterDuplicateImageCandidates(
    candidates,
    existingPhotos.map((photo) => photo.file.name),
  )

  duplicateFileNames.forEach((fileName) => {
    warnings.push(`${fileName}: duplicate skipped`)
  })

  const remainingSlots = Math.max(0, maxPhotos - existingPhotos.length)
  if (remainingSlots === 0) {
    warnings.push("Maximum number of images already selected")
    return {
      photos: existingPhotos,
      warnings,
      errors,
    }
  }

  const { acceptedCandidates: candidatesToUse, truncatedCount } = limitImageCandidates(
    uniqueCandidates,
    remainingSlots,
  )

  if (truncatedCount > 0) {
    warnings.push(`Only ${remainingSlots} additional image(s) accepted`)
  }

  const newPhotos = await Promise.all(candidatesToUse.map(createParticipantSelectedPhoto))

  const sortedPhotos = sortByExifDate([...existingPhotos, ...newPhotos], (photo) => photo.exif)

  return {
    photos: reassignOrderIndexes(sortedPhotos, topicOrderIndexes, (photo, orderIndex) => ({
      ...photo,
      orderIndex,
    })),
    warnings,
    errors,
  }
}

export async function processSelectedFiles({
  fileList,
  existingPhotos,
  maxPhotos,
  topicOrderIndexes,
}: ProcessSelectedFilesInput): Promise<ProcessSelectedFilesResult> {
  const errors: string[] = []
  const warnings: string[] = []

  if (!fileList || fileList.length === 0) {
    return {
      photos: existingPhotos,
      warnings,
      errors: ["No files selected"],
    }
  }

  if (maxPhotos <= 0) {
    return {
      photos: existingPhotos,
      warnings,
      errors: ["Select required class/topic before adding images"],
    }
  }

  const files = Array.isArray(fileList) ? fileList : Array.from(fileList)
  const { candidates, warnings: normalizationWarnings } = await normalizeSelectedImageFiles(
    files,
    COMMON_IMAGE_EXTENSIONS,
  )

  const result = await prepareParticipantSelectedPhotos({
    candidates,
    existingPhotos,
    maxPhotos,
    topicOrderIndexes,
  })

  return {
    photos: result.photos,
    warnings: [...normalizationWarnings, ...result.warnings],
    errors: [...errors, ...result.errors],
  }
}
