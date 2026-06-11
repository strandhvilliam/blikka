'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { galleryThumbnailUrl } from '../_lib/gallery-image'

type GalleryPhotoCard = {
  submissionId: number
  participantReference: string
  thumbnailKey: string | null
  topicName: string
  rank?: number | null
}

export function GalleryPhoto({
  photo,
  priority,
  onSelect,
  className,
}: {
  photo: GalleryPhotoCard
  priority?: boolean
  onSelect?: () => void
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const src = galleryThumbnailUrl(photo.thumbnailKey)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Photo ${photo.submissionId} by participant ${photo.participantReference}`}
      className={cn(
        'group relative block aspect-square w-full touch-manipulation overflow-hidden rounded-sm bg-neutral-900 outline-none',
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
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"
          onLoad={() => setLoaded(true)}
          className={cn(
            'h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.03]',
            loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-md',
          )}
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center text-xs text-neutral-600">
          No preview
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 via-black/10 to-transparent p-2.5 opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
        <span className="min-w-0 truncate font-mono text-[11px] tracking-wider text-white/90">
          #{photo.participantReference}
        </span>
        {photo.rank != null ? (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
            {ordinalLabel(photo.rank)}
          </span>
        ) : null}
      </div>
    </button>
  )
}

function ordinalLabel(rank: number): string {
  if (rank === 1) return '1st'
  if (rank === 2) return '2nd'
  if (rank === 3) return '3rd'
  return `${rank}th`
}
