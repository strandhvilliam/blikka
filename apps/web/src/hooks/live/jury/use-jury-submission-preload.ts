'use client'

import { useEffect, useRef } from 'react'
import { getOptimizedOriginalImageHref } from '@/components/submission-image'

/** Submissions kept warm on each side of the one being reviewed. */
const PRELOAD_RADIUS = 2

/**
 * Contact sheets bypass the image optimizer, so each is worth several optimized photos in bytes.
 * Reaching one neighbour deep keeps the common next/prev move instant without putting tens of
 * megabytes in front of the sheet actually on screen.
 */
const RAW_PRELOAD_RADIUS = 1

/**
 * How long the index must hold still before neighbours are fetched. Key repeat on the arrow keys
 * walks the index far faster than a juror can look at anything, and preloading every index it passes
 * through would put hundreds of requests in front of the one photo actually being waited on.
 * Scrubbing is not reviewing, so it gets no preloads at all.
 */
const SETTLE_MS = 200

/**
 * Jurors move through submissions one arrow key at a time, so the next photo is knowable well before
 * it is asked for. Fetching it up front turns the navigation into a cache hit instead of a cold
 * round-trip on a multi-megabyte original.
 */
export function useJurySubmissionPreload({
  assetUrls,
  activeIndex,
  isContactSheet,
}: {
  assetUrls: ReadonlyArray<string | undefined>
  activeIndex: number
  /** Contact sheets render through a plain `<img>`, so they warm the S3 URL rather than `/_next/image`. */
  isContactSheet: boolean
}) {
  /** Requests already issued this session — the browser cache dedupes, this avoids the churn. */
  const requestedRef = useRef(new Set<string>())

  useEffect(() => {
    const radius = isContactSheet ? RAW_PRELOAD_RADIUS : PRELOAD_RADIUS

    const timer = window.setTimeout(() => {
      for (let offset = 1; offset <= radius; offset++) {
        for (const index of [activeIndex + offset, activeIndex - offset]) {
          // Undefined for pages the infinite query has not reached yet — those preload once loaded.
          const assetUrl = assetUrls[index]
          if (!assetUrl) continue

          // Must match the URL the rendered element requests, or the preload warms nothing.
          const href = isContactSheet ? assetUrl : getOptimizedOriginalImageHref(assetUrl)
          if (!href || requestedRef.current.has(href)) continue

          requestedRef.current.add(href)

          // Deliberately not aborted on cleanup: the neighbour being fetched is usually the one the
          // juror is about to land on, and cancelling it would restart the download on arrival.
          const image = new window.Image()
          image.decoding = 'async'
          image.src = href
        }
      }
    }, SETTLE_MS)

    return () => window.clearTimeout(timer)
  }, [assetUrls, activeIndex, isContactSheet])
}
