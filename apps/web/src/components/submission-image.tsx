'use client'

import Image from 'next/image'

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
      width={2048}
      height={2048}
      quality={75}
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      className={className}
      onError={onError}
      onLoad={onLoad}
    />
  )
}

export function SubmissionRawOriginalImage({
  src,
  alt,
  className,
  loading = 'lazy',
  onError,
  onLoad,
}: SubmissionImageProps & { loading?: 'lazy' | 'eager' }) {
  if (!src) return null

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img src={src} alt={alt} className={className} loading={loading} onError={onError} onLoad={onLoad} />
  )
}
