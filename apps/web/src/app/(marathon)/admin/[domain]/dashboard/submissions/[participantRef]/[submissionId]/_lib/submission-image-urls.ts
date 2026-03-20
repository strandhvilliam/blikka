import type { Submission } from "@blikka/db"
import { buildS3Url } from "@/lib/utils"

const thumbnailBaseUrl = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
const submissionBaseUrl = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME

/** Thumbnail when available, otherwise the stored submission object (may be full-size). */
export function getSubmissionPreviewImageUrl(submission: Submission): string | null {
  if (submission.thumbnailKey && thumbnailBaseUrl) {
    return buildS3Url(thumbnailBaseUrl, submission.thumbnailKey) ?? null
  }
  if (submission.key && submissionBaseUrl) {
    return buildS3Url(submissionBaseUrl, submission.key) ?? null
  }
  return null
}

/** Original file in the submissions bucket. */
export function getSubmissionOriginalImageUrl(submission: Submission): string | null {
  if (submission.key && submissionBaseUrl) {
    return buildS3Url(submissionBaseUrl, submission.key) ?? null
  }
  return null
}

export function getSubmissionDownloadFileName(submission: Submission): string {
  const segment = submission.key.split("/").filter(Boolean).pop()
  return segment ?? `submission-${submission.id}`
}
