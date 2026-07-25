'use client'

import Image, { getImageProps } from 'next/image'

/** Optimizer parameters for a full-size submission — shared so preloads hit the rendered URL. */
const ORIGINAL_IMAGE_SIZE = 2048
const ORIGINAL_IMAGE_QUALITY = 75

export type SubmissionImageProps = {
  src: string | null | undefined
  alt: string
  className?: string
  priority?: boolean
  onError?: () => void
  onLoad?: () => void
}

export type SubmissionImageSources = {
  thumbnailUrl?: string | null
  originalUrl?: string | null
}

export type ThumbnailDisplaySource =
  | { kind: 'optimized-thumbnail'; src: string }
  | { kind: 'raw-original-fallback'; src: string }
  | { kind: 'missing' }

export type OriginalViewerSource =
  | { kind: 'optimized-original'; src: string }
  | { kind: 'optimized-thumbnail-fallback'; src: string }
  | { kind: 'missing' }

export function getThumbnailDisplaySource({
  thumbnailUrl,
  originalUrl,
}: SubmissionImageSources): ThumbnailDisplaySource {
  if (thumbnailUrl) {
    return { kind: 'optimized-thumbnail', src: thumbnailUrl }
  }

  if (originalUrl) {
    return { kind: 'raw-original-fallback', src: originalUrl }
  }

  return { kind: 'missing' }
}

export function getOriginalViewerSource({
  thumbnailUrl,
  originalUrl,
}: SubmissionImageSources): OriginalViewerSource {
  if (originalUrl) {
    return { kind: 'optimized-original', src: originalUrl }
  }

  if (thumbnailUrl) {
    return { kind: 'optimized-thumbnail-fallback', src: thumbnailUrl }
  }

  return { kind: 'missing' }
}

export function SubmissionThumbnailImage({
  src,
  alt,
  className,
  priority,
  onError,
  onLoad,
}: SubmissionImageProps) {
  if (!src) return null

  return (
    <Image
      src={src}
      alt={alt}
      width={256}
      height={256}
      quality={50}
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      className={className}
      onError={onError}
      onLoad={onLoad}
    />
  )
}

export function SubmissionOptimizedOriginalImage({
  src,
  alt,
  className,
  priority,
  onError,
  onLoad,
}: SubmissionImageProps) {
  if (!src) return null

  return (
    <Image
      src={src}
      alt={alt}
      width={ORIGINAL_IMAGE_SIZE}
      height={ORIGINAL_IMAGE_SIZE}
      quality={ORIGINAL_IMAGE_QUALITY}
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      className={className}
      onError={onError}
      onLoad={onLoad}
    />
  )
}

/**
 * The `/_next/image` URL `SubmissionOptimizedOriginalImage` will request for `src`. Preloading this
 * — rather than the raw S3 URL — warms the exact cache entry the rendered image asks for, including
 * the optimizer round-trip that dominates the wait on a cold asset.
 */
export function getOptimizedOriginalImageHref(src: string): string | null {
  try {
    return getImageProps({
      src,
      alt: '',
      width: ORIGINAL_IMAGE_SIZE,
      height: ORIGINAL_IMAGE_SIZE,
      quality: ORIGINAL_IMAGE_QUALITY,
    }).props.src
  } catch {
    return null
  }
}

export function SubmissionRawOriginalImage({
  src,
  alt,
  className,
  loading = 'lazy',
  fetchPriority,
  onError,
  onLoad,
}: SubmissionImageProps & {
  loading?: 'lazy' | 'eager'
  /** Raw images cannot take next/image's `priority`; this is the equivalent hint. */
  fetchPriority?: 'high' | 'low' | 'auto'
}) {
  if (!src) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
      onError={onError}
      onLoad={onLoad}
    />
  )
}
