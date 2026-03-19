import type { Submission } from "@blikka/db"
import { AWS_S3_BASE_URL } from "@/lib/constants"

/** Thumbnail when available, otherwise the stored submission object (may be full-size). */
export function getSubmissionPreviewImageUrl(submission: Submission): string | null {
  const thumbnailBaseUrl = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
  const submissionBaseUrl = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME
  if (submission.thumbnailKey && thumbnailBaseUrl) {
    return `${AWS_S3_BASE_URL}/${thumbnailBaseUrl}/${submission.thumbnailKey}`
  }
  if (submission.key && submissionBaseUrl) {
    return `${AWS_S3_BASE_URL}/${submissionBaseUrl}/${submission.key}`
  }
  return null
}

/** Original file in the submissions bucket. */
export function getSubmissionOriginalImageUrl(submission: Submission): string | null {
  const submissionBaseUrl = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME
  if (submission.key && submissionBaseUrl) {
    return `${AWS_S3_BASE_URL}/${submissionBaseUrl}/${submission.key}`
  }
  return null
}

export function getSubmissionDownloadFileName(submission: Submission): string {
  const segment = submission.key.split("/").filter(Boolean).pop()
  return segment ?? `submission-${submission.id}`
}
