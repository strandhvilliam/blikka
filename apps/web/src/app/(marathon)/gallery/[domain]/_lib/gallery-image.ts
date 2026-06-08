import { buildS3Url } from '@/lib/utils'

const thumbnailBaseUrl = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
const submissionBaseUrl = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME

/**
 * Optimized thumbnail URL for grid display. Public gallery never falls back to the
 * raw original object, so a missing thumbnail simply renders no image.
 */
export function galleryThumbnailUrl(thumbnailKey: string | null | undefined): string | null {
  if (thumbnailKey && thumbnailBaseUrl) {
    return buildS3Url(thumbnailBaseUrl, thumbnailKey) ?? null
  }
  return null
}

/**
 * Optimized preview URL for the lightbox. Uses the optimized `preview` object in the
 * submissions bucket — never the raw original `key`.
 */
export function galleryPreviewUrl(previewKey: string | null | undefined): string | null {
  if (previewKey && submissionBaseUrl) {
    return buildS3Url(submissionBaseUrl, previewKey) ?? null
  }
  return null
}

export function getGalleryFeedNextPageParam(
  lastPage: { nextCursor?: string | null } | null | undefined,
): string | undefined {
  return lastPage?.nextCursor ?? undefined
}
