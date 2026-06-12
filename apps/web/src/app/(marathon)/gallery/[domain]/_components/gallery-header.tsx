'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ReferenceSearch } from './reference-search'
import { Eyebrow } from './gallery-chrome'
import { cn } from '@/lib/utils'
import type { GalleryMarathonMeta } from '../_lib/types'

// Gentle ease-out so the condense settles rather than snapping between two states.
const SMOOTH = 'duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]'

/**
 * Sticky exhibition masthead. At the top of the page it shows the full masthead
 * (logo, "Gallery" eyebrow, large name, optional subtitle). Once the page scrolls it
 * condenses in place to a slim bar so the reference search stays reachable on a long
 * feed. The eyebrow and subtitle collapse via the grid-rows 1fr↔0fr trick so their
 * height animates smoothly instead of jumping. The condensed height is a fixed ~64px so
 * the feed's sticky filter bar can offset against it (see GalleryFeed `top-16`).
 */
export function GalleryHeader({
  marathon,
  subtitle,
  homeHref,
  showSearch = true,
}: {
  marathon: GalleryMarathonMeta
  subtitle?: string
  homeHref: string
  showSearch?: boolean
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let isScrolled = false
    const onScroll = () => {
      const next = window.scrollY > 8
      if (next === isScrolled) return
      isScrolled = next
      setScrolled(next)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 transition-colors',
        SMOOTH,
        scrolled
          ? 'border-b border-white/10 bg-[var(--gallery-bg)]'
          : 'border-b border-transparent',
      )}
    >
      {/* Ambient top light — only in the expanded state. */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_50%_-20%,_rgba(255,255,255,0.08),_transparent_55%)] transition-opacity',
          SMOOTH,
          scrolled ? 'opacity-0' : 'opacity-100',
        )}
      />
      <div
        className={cn(
          'relative mx-auto w-full max-w-7xl px-4 transition-all sm:px-6',
          SMOOTH,
          scrolled ? 'py-3' : 'py-8 sm:py-14',
        )}
      >
        <div
          className={cn(
            scrolled
              ? 'flex items-center justify-between gap-3'
              : 'flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between',
          )}
        >
          <Link
            href={homeHref}
            className="group flex min-w-0 items-center gap-3.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            {marathon.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={marathon.logoUrl}
                alt={`${marathon.name} logo`}
                className={cn(
                  'shrink-0 rounded-xl object-cover ring-1 ring-white/10 transition-all group-hover:scale-[1.04]',
                  SMOOTH,
                  scrolled ? 'size-9' : 'size-12',
                )}
              />
            ) : null}
            <div className="flex min-w-0 flex-col">
              <div
                className={cn(
                  'grid transition-all',
                  SMOOTH,
                  scrolled ? 'grid-rows-[0fr] opacity-0' : 'mb-0.5 grid-rows-[1fr] opacity-100',
                )}
              >
                <span className="overflow-hidden">
                  <Eyebrow>Gallery</Eyebrow>
                </span>
              </div>
              <h1
                className={cn(
                  'truncate font-gothic font-normal leading-tight tracking-tight text-white transition-all',
                  SMOOTH,
                  scrolled ? 'text-base sm:text-lg' : 'text-wrap text-2xl sm:text-3xl',
                )}
              >
                {marathon.name}
              </h1>
            </div>
          </Link>
          {showSearch ? <ReferenceSearch domain={marathon.domain} compact={scrolled} /> : null}
        </div>
        {subtitle ? (
          <div
            className={cn(
              'grid transition-all',
              SMOOTH,
              scrolled
                ? 'mt-0 grid-rows-[0fr] opacity-0'
                : 'mt-5 grid-rows-[1fr] opacity-100 sm:mt-7',
            )}
          >
            <div className="overflow-hidden">
              <p className="max-w-2xl text-sm leading-relaxed text-neutral-400">{subtitle}</p>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  )
}
