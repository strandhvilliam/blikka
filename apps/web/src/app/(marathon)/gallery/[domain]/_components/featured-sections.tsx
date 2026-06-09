'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { GalleryPhoto } from './gallery-photo'
import { GalleryLightbox } from './gallery-lightbox'
import { galleryThumbnailUrl } from '../_lib/gallery-image'
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-14 px-4 py-10 sm:px-6">
      {sections.map((section) =>
        section.kind === 'class-winners' ? (
          <ClassWinnersSection key={section.id} section={section} domain={domain} />
        ) : (
          <PhotoWinnersSection key={section.id} section={section} />
        ),
      )}
    </div>
  )
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-5 flex items-center gap-4">
      <h2 className="font-special-gothic text-lg tracking-tight text-white sm:text-xl">{title}</h2>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  )
}

function PhotoWinnersSection({ section }: { section: ResolvedFeaturedSection }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const photos = section.photos as GalleryPhotoCard[]

  return (
    <section>
      <SectionHeading title={section.title} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <div key={photo.submissionId} className="space-y-2">
            <GalleryPhoto
              photo={photo}
              priority
              onSelect={() => setActiveIndex(index)}
              className="aspect-[4/3]"
            />
          </div>
        ))}
      </div>
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

  return (
    <section>
      <SectionHeading title={section.title} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {sets.map((set) => (
          <ParticipantSetCard
            key={`${set.competitionClassId}-${set.rank}`}
            set={set}
            domain={domain}
          />
        ))}
      </div>
    </section>
  )
}

function ParticipantSetCard({
  set,
  domain,
}: {
  set: GalleryParticipantSetCard
  domain: string
}) {
  const cover = set.submissions[0]
  const coverSrc = galleryThumbnailUrl(cover?.thumbnailKey)
  const href = galleryParticipantHref(domain, set.participantReference)

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-md border border-white/10 bg-neutral-950 transition-colors hover:border-white/30"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-900">
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={`Cover by ${set.participantReference}`}
            fill
            quality={50}
            sizes="(max-width: 640px) 100vw, 33vw"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <span
          className={cn(
            'absolute left-3 top-3 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur',
          )}
        >
          {ordinalLabel(set.rank)} · {set.competitionClassName}
        </span>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-mono text-sm tracking-wider text-white">
          #{set.participantReference}
        </span>
        <span className="text-xs text-neutral-500">{set.submissions.length} photos</span>
      </div>
    </Link>
  )
}

function ordinalLabel(rank: number): string {
  if (rank === 1) return '1st'
  if (rank === 2) return '2nd'
  if (rank === 3) return '3rd'
  return `${rank}th`
}
