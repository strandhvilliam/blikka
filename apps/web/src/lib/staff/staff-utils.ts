import { buildS3Url } from "@/lib/utils"
import type { StaffSubmission } from "./staff-types"

export function normalizeParticipantReference(reference: string) {
  return reference.trim().padStart(4, "0")
}

export function getSubmissionThumbnailUrl(submission?: StaffSubmission | null) {
  if (!submission) return null

  const thumbnailUrl = buildS3Url(
    process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME,
    submission.thumbnailKey,
  )

  if (thumbnailUrl) {
    return thumbnailUrl
  }

  return buildS3Url(process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME, submission.key)
}

export function getSubmissionPreviewUrl(submission?: StaffSubmission | null) {
  if (!submission) return null

  return buildS3Url(process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME, submission.key) ?? null
}

export function getCaptureDateLabel(submission?: StaffSubmission | null) {
  if (!submission) return null

  const exif = (submission.exif as Record<string, unknown> | null) ?? {}
  const value = exif.DateTimeOriginal ?? exif.CreateDate ?? exif.DateTime
  const date = typeof value === "string" ? new Date(value) : new Date(submission.createdAt)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
