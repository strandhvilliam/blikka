'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { galleryOriginalUrl, galleryThumbnailUrl } from '../_lib/gallery-image'
import { RankMedal } from './gallery-chrome'
import type { GalleryPhotoCard } from '../_lib/types'

/** Thumbnails shown either side of the active photo in the desktop filmstrip. */
const FILMSTRIP_RADIUS = 6

export function GalleryLightbox({
  photos,
  activeIndex,
  onClose,
  onNavigate,
}: {
  photos: GalleryPhotoCard[]
  activeIndex: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}) {
  const isOpen = activeIndex !== null && activeIndex >= 0 && activeIndex < photos.length
  const photo = isOpen ? photos[activeIndex] : null
  const touchStartXRef = useRef<number | null>(null)
  const canGoPrev = activeIndex !== null && activeIndex > 0
  const canGoNext = activeIndex !== null && activeIndex < photos.length - 1

  const goPrev = useCallback(() => {
    if (activeIndex === null) return
    onNavigate(Math.max(0, activeIndex - 1))
  }, [activeIndex, onNavigate])

  const goNext = useCallback(() => {
    if (activeIndex === null) return
    onNavigate(Math.min(photos.length - 1, activeIndex + 1))
  }, [activeIndex, onNavigate, photos.length])

  const onTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
  }, [])

  const onTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const startX = touchStartXRef.current
      touchStartXRef.current = null
      if (startX === null) return

      const endX = event.changedTouches[0]?.clientX
      if (endX === undefined) return

      const deltaX = endX - startX
      if (Math.abs(deltaX) < 48) return
      if (deltaX > 0 && canGoPrev) goPrev()
      if (deltaX < 0 && canGoNext) goNext()
    },
    [canGoNext, canGoPrev, goNext, goPrev],
  )

  useEffect(() => {
    if (!isOpen) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') goPrev()
      if (event.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, goPrev, goNext])

  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

  if (!isOpen || !photo) return null

  const src = galleryOriginalUrl(photo.key) ?? galleryThumbnailUrl(photo.thumbnailKey)
  const currentIndex = activeIndex ?? 0

  // Filmstrip shows a sliding window of thumbnails centred on the active photo.
  const stripStart = Math.max(0, currentIndex - FILMSTRIP_RADIUS)
  const stripEnd = Math.min(photos.length, currentIndex + FILMSTRIP_RADIUS + 1)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex h-dvh flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-4 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white/80 sm:px-5 sm:py-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-sm tracking-wider text-white">
              #{photo.participantReference}
            </span>
            {photo.rank != null ? <RankMedal rank={photo.rank} /> : null}
          </span>
          <span className="truncate text-xs text-white/50">{photo.topicName}</span>
        </div>
        <span className="hidden text-xs font-medium text-white/40 sm:inline">
          {currentIndex + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="size-5" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-3 pb-3 sm:px-16 sm:pb-8"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {canGoPrev ? (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous photo"
            className="absolute left-4 top-1/2 hidden size-12 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:flex"
          >
            <ChevronLeft className="size-6" />
          </button>
        ) : null}

        {src ? (
          <Image
            src={src}
            alt={`Submission by ${photo.participantReference}`}
            width={2048}
            height={2048}
            quality={75}
            priority
            sizes="100vw"
            className="max-h-full w-auto max-w-full object-contain"
          />
        ) : (
          <div className="text-sm text-white/50">No preview available</div>
        )}

        {canGoNext ? (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next photo"
            className="absolute right-4 top-1/2 hidden size-12 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:flex"
          >
            <ChevronRight className="size-6" />
          </button>
        ) : null}
      </div>

      {photos.length > 1 ? (
        <div
          className="hidden shrink-0 items-center justify-center gap-1.5 px-4 pb-6 pt-1 sm:flex"
          onClick={(event) => event.stopPropagation()}
        >
          {photos.slice(stripStart, stripEnd).map((stripPhoto, offset) => {
            const realIndex = stripStart + offset
            const thumb = galleryThumbnailUrl(stripPhoto.thumbnailKey)
            const isActive = realIndex === currentIndex
            return (
              <button
                key={stripPhoto.submissionId}
                type="button"
                onClick={() => onNavigate(realIndex)}
                aria-label={`View photo ${realIndex + 1}`}
                aria-current={isActive}
                className={cn(
                  'relative size-14 shrink-0 overflow-hidden rounded-md bg-neutral-900 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/70',
                  isActive ? 'ring-2 ring-white' : 'opacity-45 ring-1 ring-white/10 hover:opacity-90',
                )}
              >
                {thumb ? (
                  <Image
                    src={thumb}
                    alt=""
                    fill
                    quality={50}
                    sizes="56px"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}

      <div
        className="flex shrink-0 items-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={goPrev}
          disabled={!canGoPrev}
          className={cn(
            'flex h-11 flex-1 touch-manipulation items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
            canGoPrev ? 'hover:bg-white/10' : 'cursor-not-allowed opacity-35',
          )}
        >
          <ChevronLeft className="size-4" />
          Previous
        </button>
        <span className="min-w-14 text-center text-xs font-medium text-white/45">
          {currentIndex + 1}/{photos.length}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          className={cn(
            'flex h-11 flex-1 touch-manipulation items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 text-sm font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
            canGoNext ? 'hover:bg-white/10' : 'cursor-not-allowed opacity-35',
          )}
        >
          Next
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
