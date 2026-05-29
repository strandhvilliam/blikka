import { Suspense } from 'react'
import { HydrateClient } from '@/lib/trpc/server'

import { getQueryClient, prefetch, trpc } from '@/lib/trpc/server'
import { Splash } from '@/components/splash'
import {
  flowStateServerLoader,
  flowStateServerParamSerializer,
} from '@/lib/flow-state-params-server'
import { notFound, redirect } from 'next/navigation'
import { VerificationClient } from '@/components/live/flow/verification-client'
import { formatDomainPathname } from '@/lib/utils'

export default async function VerificationPage({
  params,
  searchParams,
}: PageProps<'/live/[domain]/verification'>) {
  const { domain } = await params
  const queryParams = await flowStateServerLoader(searchParams)

  if (!queryParams?.participantRef) {
    return notFound()
  }

  prefetch(
    trpc.participants.getPublicParticipantByReference.queryOptions({
      domain,
      reference: queryParams.participantRef,
    }),
  )

  const queryClient = getQueryClient()
  const participant = await queryClient.fetchQuery(
    trpc.participants.getPublicParticipantByReference.queryOptions({
      domain,
      reference: queryParams.participantRef!,
    }),
  )

  if (!participant) {
    return notFound()
  }

  // If already verified, redirect to confirmation
  if (participant.status === 'verified') {
    const redirectParams = flowStateServerParamSerializer(queryParams)
    redirect(formatDomainPathname(`/live/confirmation${redirectParams}`, domain))
  }

  return (
    <HydrateClient>
      <Suspense fallback={<Splash />}>
        <VerificationClient
          participantRef={queryParams.participantRef}
          participantId={queryParams.participantId ?? undefined}
        />
      </Suspense>
    </HydrateClient>
  )
}
