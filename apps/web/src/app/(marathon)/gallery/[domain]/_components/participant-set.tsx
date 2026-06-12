'use client'

import { useState } from 'react'
import { GalleryPhoto } from './gallery-photo'
import { GalleryLightbox } from './gallery-lightbox'
import { JustifiedGrid } from './justified-grid'
import { Eyebrow } from './gallery-chrome'
import type { GalleryParticipantSetResult, GalleryPhotoCard } from '../_lib/types'

export function ParticipantSet({
  participantSet,
}: {
  participantSet: GalleryParticipantSetResult
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // Submissions arrive sorted by topic order. We keep them in one flat array so the
  // lightbox traverses every photo, and lay them out as a single seamless mosaic rather
  // than one-photo-per-topic sections (which read as a sparse column).
  const photos: GalleryPhotoCard[] = participantSet.submissions.map((submission) => ({
    submissionId: submission.submissionId,
    participantReference: participantSet.reference,
    thumbnailKey: submission.thumbnailKey,
    key: submission.key,
    topicId: submission.topicId,
    topicName: submission.topicName,
    topicOrderIndex: submission.topicOrderIndex,
    competitionClassId: participantSet.competitionClassId,
    competitionClassName: participantSet.competitionClassName,
    rank: null,
    aspectRatio: submission.aspectRatio,
  }))

  const topicCount = new Set(photos.map((photo) => photo.topicId)).size

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
      <div className="mb-9 flex flex-col gap-1.5 border-b border-white/10 pb-7">
        <Eyebrow>Participant</Eyebrow>
        <h2 className="break-all font-mono text-3xl font-bold tracking-wider text-white sm:text-4xl">
          #{participantSet.reference}
        </h2>
        <p className="text-sm text-neutral-500">
          {participantSet.competitionClassName ? `${participantSet.competitionClassName} · ` : ''}
          {participantSet.submissions.length} submissions
          {topicCount > 1 ? ` · ${topicCount} topics` : ''}
        </p>
      </div>

      <JustifiedGrid stretchLastRow>
        {photos.map((photo, index) => (
          <GalleryPhoto
            key={photo.submissionId}
            photo={photo}
            priority={index < 8}
            onSelect={() => setActiveIndex(index)}
          />
        ))}
      </JustifiedGrid>

      <GalleryLightbox
        photos={photos}
        activeIndex={activeIndex}
        onClose={() => setActiveIndex(null)}
        onNavigate={setActiveIndex}
      />
    </section>
  )
}
