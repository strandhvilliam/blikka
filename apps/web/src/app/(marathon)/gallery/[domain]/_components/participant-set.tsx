'use client'

import { useState } from 'react'
import { GalleryPhoto } from './gallery-photo'
import { GalleryLightbox } from './gallery-lightbox'
import type { GalleryParticipantSetResult, GalleryPhotoCard } from '../_lib/types'

export function ParticipantSet({
  participantSet,
}: {
  participantSet: GalleryParticipantSetResult
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const photos: GalleryPhotoCard[] = participantSet.submissions.map((submission) => ({
    submissionId: submission.submissionId,
    participantReference: participantSet.reference,
    thumbnailKey: submission.thumbnailKey,
    previewKey: submission.previewKey,
    topicId: submission.topicId,
    topicName: submission.topicName,
    topicOrderIndex: submission.topicOrderIndex,
    competitionClassId: participantSet.competitionClassId,
    competitionClassName: participantSet.competitionClassName,
    rank: null,
  }))

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
      <div className="mb-8 flex flex-col gap-1 border-b border-white/5 pb-6">
        <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-neutral-500">
          Participant
        </span>
        <h2 className="font-mono text-3xl tracking-wider text-white">
          #{participantSet.reference}
        </h2>
        <p className="text-sm text-neutral-500">
          {participantSet.competitionClassName ? `${participantSet.competitionClassName} · ` : ''}
          {participantSet.submissions.length} submissions
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <GalleryPhoto
            key={photo.submissionId}
            photo={photo}
            priority={index < 8}
            onSelect={() => setActiveIndex(index)}
          />
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
