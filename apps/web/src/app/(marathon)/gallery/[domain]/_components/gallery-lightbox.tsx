'use client'

import Image from 'next/image'
import { useCallback, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { galleryOriginalUrl, galleryThumbnailUrl } from '../_lib/gallery-image'
import type { GalleryPhotoCard } from '../_lib/types'

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

  const goPrev = useCallback(() => {
    if (activeIndex === null) return
    onNavigate(Math.max(0, activeIndex - 1))
  }, [activeIndex, onNavigate])

  const goNext = useCallback(() => {
    if (activeIndex === null) return
    onNavigate(Math.min(photos.length - 1, activeIndex + 1))
  }, [activeIndex, onNavigate, photos.length])

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-5 py-4 text-white/80">
        <div className="flex flex-col">
          <span className="font-mono text-sm tracking-wider text-white">
            #{photo.participantReference}
          </span>
          <span className="text-xs text-white/50">{photo.topicName}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center px-4 pb-8 sm:px-16"
        onClick={(event) => event.stopPropagation()}
      >
        {activeIndex !== null && activeIndex > 0 ? (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/5 p-3 text-white/70 transition-colors hover:bg-white/15 hover:text-white sm:left-4"
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
            className="max-h-full w-auto max-w-full object-contain"
          />
        ) : (
          <div className="text-sm text-white/50">No preview available</div>
        )}

        {activeIndex !== null && activeIndex < photos.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/5 p-3 text-white/70 transition-colors hover:bg-white/15 hover:text-white sm:right-4"
          >
            <ChevronRight className="size-6" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
