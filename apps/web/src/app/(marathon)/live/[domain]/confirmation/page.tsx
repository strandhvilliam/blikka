import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server'
import { Suspense } from 'react'
import { Splash } from '@/components/splash'
import { notFound } from 'next/navigation'
import { flowStateServerLoader } from '@/lib/flow-state-params-server'
import { ConfirmationClient } from '@/components/live/confirmation-client'

export default async function ConfirmationPage({
  params,
  searchParams,
}: PageProps<'/live/[domain]'>) {
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
  return (
    <HydrateClient>
      <Suspense fallback={<Splash />}>
        <ConfirmationClient
          params={{
            participantRef: queryParams.participantRef,
            participantFirstName: queryParams.participantFirstName ?? '',
            participantLastName: queryParams.participantLastName ?? '',
          }}
        />
      </Suspense>
    </HydrateClient>
  )
}
