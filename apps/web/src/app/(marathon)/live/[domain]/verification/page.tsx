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
import { toMarathonVerificationMode } from '@/lib/flow/verification-routing'

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
  prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }))

  const queryClient = getQueryClient()
  const [participant, marathon] = await Promise.all([
    queryClient.fetchQuery(
      trpc.participants.getPublicParticipantByReference.queryOptions({
        domain,
        reference: queryParams.participantRef!,
      }),
    ),
    queryClient.fetchQuery(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain })),
  ])

  if (!participant) {
    return notFound()
  }

  const verificationMode = toMarathonVerificationMode(marathon.verificationMode)

  if (participant.status === 'verified' || verificationMode === 'none') {
    const redirectParams = flowStateServerParamSerializer(queryParams)
    redirect(formatDomainPathname(`/live/confirmation${redirectParams}`, domain))
  }

  return (
    <HydrateClient>
      <Suspense fallback={<Splash />}>
        <VerificationClient
          participantRef={queryParams.participantRef}
          participantId={queryParams.participantId ?? undefined}
          verificationMode={verificationMode}
        />
      </Suspense>
    </HydrateClient>
  )
}
