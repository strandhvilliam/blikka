import { runValidations } from "@blikka/validation/validator"
import { RuleConfig, RuleKey, ValidationResult } from "../../../../packages/validation/old/types"
import { SelectedPhotoV2 } from "./types"
import { toast } from "sonner"
import { generateThumbnailWithCallback } from "./image-resize"
import { parseExifData } from "./parse-exif-data"

interface ParsedAndValidatedPhotos {
  updatedPhotos: {
    file: File
    exif: { [key: string]: unknown }
    preview: string
    thumbnail?: string | null
    thumbnailLoading?: boolean
    orderIndex: number
  }[]
  validationResults: ValidationResult[]
}

export async function parseAndValidateFiles(
  currentPhotos: SelectedPhotoV2[],
  files: File[],
  ruleConfigs: RuleConfig<RuleKey>[],
  orderIndexes: number[],
  maxPhotos: number,
  preconvertedExifData: { name: string; exif: any }[],
  updateThumbnail?: (fileName: string, thumbnail: string) => void
): Promise<ParsedAndValidatedPhotos> {
  const currentLength = currentPhotos.length
  const remainingSlots = maxPhotos - currentLength
  const sortedOrderIndexes = orderIndexes.sort((a, b) => a - b)

  const sameNamePhotos = files.filter((file) =>
    currentPhotos.some((p) => p.file.name === file.name)
  )
  if (sameNamePhotos.length > 0) {
    toast.error(
      `${(sameNamePhotos.map((f) => f.name) as string[]).join(", ")} already selected and not added`
    )
  }

  const uniqueNewPhotos = files.filter((f) => !sameNamePhotos.some((p) => p.name === f.name))

  if (uniqueNewPhotos.length > remainingSlots) {
    toast.warning(
      `More than ${remainingSlots} photos selected, only ${remainingSlots} will be added`
    )
  }

  const newPhotos = await Promise.all(
    uniqueNewPhotos.slice(0, remainingSlots).map(async (file, index) => {
      const orderIndex = sortedOrderIndexes[currentLength + index]
      if (!orderIndex && orderIndex !== 0) return null

      const preconvertedExif = preconvertedExifData.find((p) => p.name === file.name)

      let exif = preconvertedExif?.exif ?? (await parseExifData(file))

      if (!exif) {
        exif = {}
      }

      return {
        file,
        exif: exif as { [key: string]: unknown },
        preconvertedExif: (preconvertedExif?.exif ?? null) as {
          [key: string]: unknown
        } | null,
        preview: URL.createObjectURL(file),
        thumbnail: null,
        thumbnailLoading: true,
        orderIndex,
      }
    })
  )
  const validPhotos = newPhotos.filter((photo) => photo !== null) satisfies SelectedPhotoV2[]

  const sortedByTime = [...currentPhotos, ...validPhotos]
    .sort((a, b) => {
      const aDate = getExifDate(a.exif)
      const bDate = getExifDate(b.exif)
      if (!aDate && !bDate) return 0
      if (!aDate) return 1
      if (!bDate) return -1
      return new Date(aDate).getTime() - new Date(bDate).getTime()
    })
    .map((photo, index) => ({
      ...photo,
      orderIndex: sortedOrderIndexes[index] ?? -1,
    }))
    .filter((photo) => photo.orderIndex !== -1)

  const validationInputs = sortedByTime.map((photo) => ({
    exif: photo.exif,
    fileName: photo.file.name,
    fileSize: photo.file.size,
    orderIndex: photo.orderIndex,
    mimeType: photo.file.type,
  }))

  const validationResults = runValidations(ruleConfigs, validationInputs)

  // Generate thumbnails asynchronously using proper Zustand pattern
  validPhotos.map(async (photo) => {
    try {
      const thumbnail = await generateThumbnailWithCallback(photo.file, 200, (stage) => {
        // Don't call updateThumbnail on worker-failed, only on final completion
        if (stage === "fallback-complete") {
          // Thumbnail generation completed (either worker success or fallback success)
          // The actual thumbnail will be set in the success block below
        }
      })
      // Only call updateThumbnail when we have the final thumbnail
      updateThumbnail?.(photo.file.name, thumbnail)
    } catch (error) {
      console.error("Thumbnail generation failed:", error)
      // Set empty thumbnail and stop loading state
      updateThumbnail?.(photo.file.name, "")
    }
  })

  return {
    updatedPhotos: sortedByTime,
    validationResults,
  }
}

function getExifDate(exif: { [key: string]: unknown }) {
  if (!exif) return null
  if (exif.DateTimeOriginal) return exif.DateTimeOriginal as string
  if (exif.CreateDate) return exif.CreateDate as string
  return null
}
