'use client'

import { ImageOff, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  SubmissionOptimizedOriginalImage,
  SubmissionRawOriginalImage,
} from '@/components/submission-image'

/** Below this a preloaded photo has usually decoded, and the spinner would flash rather than inform. */
const SPINNER_DELAY_MS = 150

/**
 * Mount this keyed by asset so each submission gets a fresh element. Reusing one `<img>` across
 * submissions leaves the previous photo on screen until the next one decodes, which reads as a
 * stalled viewer — and worse, pairs the outgoing photo with the incoming participant's sidebar.
 */
export function JurySubmissionPhoto({
  src,
  alt,
  isContactSheet,
  onError,
}: {
  src: string | undefined
  alt: string
  isContactSheet: boolean
  onError: () => void
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSpinnerVisible, setIsSpinnerVisible] = useState(false)

  useEffect(() => {
    if (!isLoading) return

    const timer = window.setTimeout(() => setIsSpinnerVisible(true), SPINNER_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [isLoading])

  if (!src) {
    return (
      <div className="flex max-w-sm flex-col items-center justify-center px-6 text-center">
        <ImageOff className="mb-4 h-12 w-12 text-brand-gray/30" />
        <p className="font-gothic text-lg font-bold text-brand-black/60">
          {isContactSheet ? 'Contact sheet unavailable' : 'Image unavailable'}
        </p>
        <p className="mt-2 text-sm text-brand-gray">
          The asset could not be loaded for this participant.
        </p>
      </div>
    )
  }

  const imageProps = {
    src,
    alt,
    className: `h-auto max-h-[75vh] w-auto max-w-full object-contain transition-opacity duration-200 ${
      isLoading ? 'opacity-0' : 'opacity-100'
    }`,
    onLoad: () => setIsLoading(false),
    onError: () => {
      setIsLoading(false)
      onError()
    },
  }

  return (
    <>
      {isContactSheet ? (
        // Contact sheets stay off the image optimizer on purpose: there is one per participant, so a
        // large class would burn a transformation per sheet, and jurors zoom into individual frames
        // where the downscale would cost the detail they are looking for.
        <SubmissionRawOriginalImage {...imageProps} loading="eager" fetchPriority="high" />
      ) : (
        <SubmissionOptimizedOriginalImage {...imageProps} priority />
      )}

      {isLoading && isSpinnerVisible ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-gray/40" />
        </div>
      ) : null}
    </>
  )
}
