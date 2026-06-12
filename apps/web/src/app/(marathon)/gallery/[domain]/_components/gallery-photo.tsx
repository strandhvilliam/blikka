'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { galleryThumbnailUrl } from '../_lib/gallery-image'
import { RankMedal } from './gallery-chrome'

type GalleryPhotoCard = {
  submissionId: number
  participantReference: string
  thumbnailKey: string | null
  topicName: string
  rank?: number | null
  aspectRatio?: number | null
}

/**
 * A single photo tile sized as a justified-row flex item. The aspect ratio (from EXIF,
 * falling back to square) drives `flex-grow`/`flex-basis` against the `--gallery-row-h`
 * variable provided by {@link JustifiedGrid}.
 */
export function GalleryPhoto({
  photo,
  priority,
  onSelect,
  className,
  cornerMedal = false,
}: {
  photo: GalleryPhotoCard
  priority?: boolean
  onSelect?: () => void
  className?: string
  /** Show an always-visible rank medal in the top-left corner (used for winners). */
  cornerMedal?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const src = galleryThumbnailUrl(photo.thumbnailKey)
  const aspect = photo.aspectRatio && photo.aspectRatio > 0 ? photo.aspectRatio : 1

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Photo ${photo.submissionId} by participant ${photo.participantReference}`}
      style={{ flexGrow: aspect, flexBasis: `calc(var(--gallery-row-h) * ${aspect})` }}
      className={cn(
        'group relative block h-[var(--gallery-row-h)] min-w-0 touch-manipulation overflow-hidden bg-neutral-900 outline-none',
        'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={`Submission by ${photo.participantReference}`}
          width={640}
          height={640}
          quality={50}
          priority={priority}
          loading={priority ? 'eager' : 'lazy'}
          sizes="(max-width: 640px) 60vw, (max-width: 1024px) 40vw, 28vw"
          onLoad={() => setLoaded(true)}
          className={cn(
            'h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.03]',
            loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-md',
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">
          No preview
        </div>
      )}

      {cornerMedal && photo.rank != null ? (
        <span className="pointer-events-none absolute left-2.5 top-2.5">
          <RankMedal rank={photo.rank} />
        </span>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 via-black/10 to-transparent p-2.5">
        <span className="min-w-0 truncate font-mono text-[11px] font-bold tracking-wider text-white/90">
          #{photo.participantReference}
          {photo.topicName ? (
            <span className="ml-1.5 font-sans font-normal tracking-normal text-white/65">
              {photo.topicName}
            </span>
          ) : null}
        </span>
        {!cornerMedal && photo.rank != null ? <RankMedal rank={photo.rank} /> : null}
      </div>
    </button>
  )
}
