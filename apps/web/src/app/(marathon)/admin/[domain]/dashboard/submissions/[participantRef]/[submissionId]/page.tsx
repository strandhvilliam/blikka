import { HydrateClient } from '@/lib/trpc/server'
import { Suspense } from 'react'
import { batchPrefetch, trpc } from '@/lib/trpc/server'
import { ParticipantSubmissionClientPage } from './_components/client-page'
import { SubmissionPageSkeleton } from './_components/submission-page-skeleton'

export default async function ParticipantSubmissionPage({
  params,
}: PageProps<'/admin/[domain]/dashboard/submissions/[participantRef]/[submissionId]'>) {
  const { domain, participantRef, submissionId } = await params

  batchPrefetch([
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    }),
  ])

  return (
    <HydrateClient>
      <Suspense fallback={<SubmissionPageSkeleton />}>
        <ParticipantSubmissionClientPage
          participantRef={participantRef}
          submissionId={Number(submissionId)}
        />
      </Suspense>
    </HydrateClient>
  )
}
