'use client'

import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import { ParticipantSubmissionCard } from './participant-submission-card'
import {
  SubmissionPreviewDialog,
  type SubmissionPreviewItem,
} from './submission-preview-dialog'
import { cn } from '@/lib/utils'
import { useDomain } from '@/lib/domain-provider'
import type { ParticipantWithRelations } from '../_lib/utils'

function buildSubmissionPreviewItems(
  participant: ParticipantWithRelations,
): SubmissionPreviewItem[] {
  if (!participant.submissions) return []
  return participant.submissions
    .filter((submission) => submission.topic)
    .map((submission) => ({
      submission: submission as SubmissionPreviewItem['submission'],
      validationResults:
        participant.validationResults?.filter(
          (result) => result.fileName && result.fileName.includes(submission.key),
        ) ?? [],
    }))
    .toSorted(
      (a, b) => (a.submission.topic?.orderIndex ?? 0) - (b.submission.topic?.orderIndex ?? 0),
    )
}

export function ParticipantSubmissionsTab({ participantRef }: { participantRef: string }) {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    }),
  )

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null)
  const items = buildSubmissionPreviewItems(participant)

  return (
    <>
      <div
        className={cn(
          'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
          items.length < 12 ? 'xl:grid-cols-4' : 'xl:grid-cols-6',
        )}
      >
        {items.map((item) => (
          <ParticipantSubmissionCard
            key={item.submission.id}
            submission={item.submission}
            validationResults={item.validationResults}
            onSelect={setSelectedSubmissionId}
          />
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No photos submitted yet
          </div>
        )}
      </div>

      <SubmissionPreviewDialog
        items={items}
        selectedSubmissionId={selectedSubmissionId}
        onSelectedSubmissionIdChange={setSelectedSubmissionId}
        participantRef={participantRef}
      />
    </>
  )
}
