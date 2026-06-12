'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { GalleryLightbox } from './gallery-lightbox'
import { SectionHeading, RankMedal } from './gallery-chrome'
import { galleryOriginalUrl, galleryThumbnailUrl } from '../_lib/gallery-image'
import { galleryParticipantHref } from '../_lib/href'
import { cn } from '@/lib/utils'
import type {
  GalleryParticipantSetCard,
  GalleryPhotoCard,
  ResolvedFeaturedSection,
} from '../_lib/types'

export function FeaturedSections({
  sections,
  domain,
}: {
  sections: ResolvedFeaturedSection[]
  domain: string
}) {
  if (sections.length === 0) return null

  // With several winner groups, a master "Winners" hero frames them. With a single
  // group (e.g. a by-camera topic), that hero just double-labels the lone section, so
  // the section's own heading carries it instead.
  const showHero = sections.length > 1

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 pb-4 sm:px-6 sm:pt-6">
      {showHero ? <SectionHeading title="Winners" size="lg" /> : null}

      <div className="space-y-16">
        {sections.map((section) =>
          section.kind === 'class-winners' ? (
            <ClassWinnersSection key={section.id} section={section} domain={domain} />
          ) : (
            <PhotoWinnersSection key={section.id} section={section} />
          ),
        )}
      </div>
    </div>
  )
}

/**
 * Top-3 winners as a single "hero + pair" mosaic: 1st place fills the full width as a
 * hero tile, 2nd and 3rd sit side-by-side beneath it. Each tile crops to its cell
 * (object-cover) so the trio reads as one cohesive mosaic — with the rank as an overlaid
 * medal — rather than three separate cards. Degrades gracefully for 1 or 2 winners.
 */
function WinnerMosaic({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:gap-3">{children}</div>
}

type RailThumb = { submissionId: number; thumbnailKey: string | null }

// How many of a participant's remaining photos preview in the rail before a "+N" tile.
// The hero lays them out as a 2-column grid; 2nd/3rd as a single row.
const MAX_RAIL_THUMBS = 4

function RailCell({
  src,
  overflow,
  grow = false,
}: {
  src: string | null
  overflow: number
  grow?: boolean
}) {
  return (
    <div
      className={cn('relative min-h-0 min-w-0 overflow-hidden bg-neutral-950', grow && 'flex-1')}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          quality={50}
          sizes="160px"
          className={cn('h-full w-full object-cover', overflow > 0 && 'opacity-30')}
        />
      ) : null}
      {overflow > 0 ? (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}

function WinnerTile({
  rank,
  src,
  alt,
  label,
  meta,
  href,
  onClick,
  thumbnails,
  hero = false,
  wide = false,
}: {
  rank: number
  src?: string | null
  alt: string
  label: string
  meta?: React.ReactNode
  href?: string
  onClick?: () => void
  /** A participant's remaining photos — shown as a thumbnail rail (right of hero, below 2nd/3rd). */
  thumbnails?: RailThumb[]
  /** 1st place — full width, taller, larger medal/label. */
  hero?: boolean
  /** A lone 2nd place (only two winners) spans the full width instead of leaving a gap. */
  wide?: boolean
}) {
  const rail = thumbnails ?? []
  const hasRail = rail.length > 0
  // Reserve the last rail slot for a "+N" overflow indicator when there are extra photos.
  const visibleThumbs =
    rail.length > MAX_RAIL_THUMBS
      ? rail.slice(0, MAX_RAIL_THUMBS - 1)
      : rail.slice(0, MAX_RAIL_THUMBS)
  const hiddenCount = rail.length - visibleThumbs.length
  const railCells = [
    ...visibleThumbs.map((thumb) => ({
      key: String(thumb.submissionId),
      src: galleryThumbnailUrl(thumb.thumbnailKey),
      overflow: 0,
    })),
    ...(hiddenCount > 0
      ? [
          {
            key: 'overflow',
            src: galleryThumbnailUrl(rail[rail.length - 1]?.thumbnailKey),
            overflow: hiddenCount,
          },
        ]
      : []),
  ]
  const heroRailRows = Math.ceil(railCells.length / 2)

  const cellClass = cn(
    'group relative flex overflow-hidden bg-neutral-900 text-left outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    // Hero uses a definite height (not aspect-ratio) so the rail's `1fr` grid rows
    // resolve against a real height instead of ballooning to fit the thumbnails.
    hero ? 'col-span-2 h-72 sm:h-80 lg:h-96' : wide ? 'col-span-2 aspect-[5/2]' : 'aspect-[4/3]',
    // Hero keeps the rail on the right; 2nd/3rd stack it below.
    hasRail && (hero ? 'gap-1 sm:gap-1.5' : 'flex-col gap-1 sm:gap-1.5'),
  )

  const cover = (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority
          quality={hero ? 75 : 50}
          sizes={hero ? '(max-width: 640px) 100vw, 1280px' : '(max-width: 640px) 50vw, 640px'}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">
          No preview
        </div>
      )}

      <span className={cn('absolute', hero ? 'left-4 top-4' : 'left-3 top-3')}>
        <RankMedal
          rank={rank}
          className={hero ? 'size-12 text-lg sm:size-14 sm:text-xl' : undefined}
        />
      </span>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/15 to-transparent p-3 sm:p-4">
        <span
          className={cn(
            'min-w-0 truncate font-mono font-bold tracking-wider text-white',
            hero ? 'text-base sm:text-lg' : 'text-xs sm:text-sm',
          )}
        >
          #{label}
        </span>
        {meta ? <span className="shrink-0 text-xs text-neutral-300">{meta}</span> : null}
      </div>
    </div>
  )

  const railEl = !hasRail ? null : hero ? (
    // 1st place: two vertical columns of previews filling the hero's height.
    <div
      className="grid w-56 shrink-0 gap-1 sm:w-80 sm:gap-1.5 lg:w-[26rem]"
      style={{
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gridTemplateRows: `repeat(${heroRailRows}, minmax(0, 1fr))`,
      }}
    >
      {railCells.map((cell) => (
        <RailCell key={cell.key} src={cell.src} overflow={cell.overflow} />
      ))}
    </div>
  ) : (
    // 2nd / 3rd: a single row of previews beneath the cover.
    <div className="flex h-14 shrink-0 gap-1 sm:h-20 sm:gap-1.5">
      {railCells.map((cell) => (
        <RailCell key={cell.key} src={cell.src} overflow={cell.overflow} grow />
      ))}
    </div>
  )

  const body = (
    <>
      {cover}
      {railEl}
    </>
  )

  if (href) {
    return (
      <Link href={href} aria-label={`View submissions by ${label}`} className={cellClass}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-label={`Photo by ${label}`} className={cellClass}>
      {body}
    </button>
  )
}

function PhotoWinnersSection({ section }: { section: ResolvedFeaturedSection }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const photos = section.photos as GalleryPhotoCard[]
  if (photos.length === 0) return null

  return (
    <section>
      <SectionHeading title={photos[0]?.topicName ?? section.title} meta={`Top ${photos.length}`} />
      <WinnerMosaic>
        {photos.map((photo, index) => (
          <WinnerTile
            key={photo.submissionId}
            rank={photo.rank ?? index + 1}
            src={galleryOriginalUrl(photo.key) ?? galleryThumbnailUrl(photo.thumbnailKey)}
            alt={`Submission by ${photo.participantReference}`}
            label={photo.participantReference}
            hero={index === 0}
            wide={index === 1 && photos.length === 2}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </WinnerMosaic>
      <GalleryLightbox
        photos={photos}
        activeIndex={activeIndex}
        onClose={() => setActiveIndex(null)}
        onNavigate={setActiveIndex}
      />
    </section>
  )
}

function ClassWinnersSection({
  section,
  domain,
}: {
  section: ResolvedFeaturedSection
  domain: string
}) {
  const sets = section.participantSets as GalleryParticipantSetCard[]
  if (sets.length === 0) return null

  return (
    <section>
      <SectionHeading
        title={sets[0]?.competitionClassName ?? section.title}
        meta={`Top ${sets.length}`}
      />
      <WinnerMosaic>
        {sets.map((set, index) => (
          <WinnerTile
            key={`${set.competitionClassId}-${set.rank}`}
            rank={set.rank}
            src={
              galleryOriginalUrl(set.submissions[0]?.key) ??
              galleryThumbnailUrl(set.submissions[0]?.thumbnailKey)
            }
            alt={`Cover by ${set.participantReference}`}
            label={set.participantReference}
            meta={
              <span className="inline-flex items-center gap-1 transition-colors group-hover:text-white">
                {set.submissions.length} photos
                <ArrowUpRight className="size-3.5" />
              </span>
            }
            href={galleryParticipantHref(domain, set.participantReference)}
            thumbnails={set.submissions.slice(1)}
            hero={index === 0}
            wide={index === 1 && sets.length === 2}
          />
        ))}
      </WinnerMosaic>
    </section>
  )
}
