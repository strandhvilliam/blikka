import { flowStateServerLoader } from '@/lib/flow-state-params-server'
import { notFound } from 'next/navigation'

import { PrepareCompletedClient } from '@/components/live/flow/prepare-completed-client'
import { fetchServerQuery, trpc } from '@/lib/trpc/server'

export default async function PrepareCompletedPage({
  params,
  searchParams,
}: PageProps<'/live/[domain]'>) {
  const { domain } = await params
  const queryParams = await flowStateServerLoader(searchParams)

  if (!queryParams?.participantRef) {
    return notFound()
  }

  const participant = await fetchServerQuery(
    trpc.participants.getPublicParticipantByReference.queryOptions({
      domain,
      reference: queryParams.participantRef,
    }),
  )

  return (
    <PrepareCompletedClient
      domain={domain}
      params={{
        participantRef: queryParams.participantRef,
        participantFirstName: queryParams.participantFirstName ?? '',
        participantLastName: queryParams.participantLastName ?? '',
        participantEmail: queryParams.participantEmail ?? '',
        competitionClassName: participant.competitionClass.name,
        deviceGroupName: participant.deviceGroup.name,
      }}
    />
  )
}
