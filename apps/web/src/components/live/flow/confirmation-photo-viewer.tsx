'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

import type { ConfirmationImage } from './confirmation-marathon-client'

/**
 * Full-screen viewer for a submitted series. Mounted only while open, so
 * `initialIndex` can seed state directly.
 *
 * Paging is native scroll-snap rather than a drag handler: on touch that brings
 * real momentum, rubber-banding at the ends and interruptible flicks for free.
 */
export function ConfirmationPhotoViewer({
  images,
  initialIndex,
  onClose,
}: {
  images: ConfirmationImage[]
  initialIndex: number
  onClose: () => void
}) {
  const t = useTranslations('ConfirmationPage')
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(initialIndex)

  // Jump to the tapped photo before paint, so the viewer never flashes photo 1.
  useLayoutEffect(() => {
    const track = trackRef.current
    if (track) track.scrollLeft = initialIndex * track.clientWidth
  }, [initialIndex])

  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  const page = useCallback((delta: number) => {
    const track = trackRef.current
    if (!track) return
    const next = Math.round(track.scrollLeft / track.clientWidth) + delta
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowRight') page(1)
      else if (event.key === 'ArrowLeft') page(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, page])

  const current = images[active]

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 opacity-0 [animation:confirmation-fade_180ms_var(--ease-out-strong)_forwards] motion-reduce:animate-none motion-reduce:opacity-100"
      role="dialog"
      aria-modal="true"
      aria-label={current?.name}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{current?.name}</p>
          <p className="mt-0.5 text-xs text-white/50 tabular-nums">
            {active + 1} / {images.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeViewer')}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 transition-transform duration-150 ease-out-strong active:scale-[0.92]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={trackRef}
        onScroll={(event) => {
          const el = event.currentTarget
          const next = Math.round(el.scrollLeft / el.clientWidth)
          if (next !== active && images[next]) setActive(next)
        }}
        className="confirmation-hide-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {images.map((image, index) => (
          <div
            key={image.orderIndex}
            className="flex w-full shrink-0 snap-center items-center justify-center px-4"
          >
            {/* Only the neighbours are mounted — a full series can be 24 photos. */}
            {Math.abs(index - active) <= 1 && image.imageUrl ? (
              <img
                src={image.imageUrl}
                alt={image.name}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
