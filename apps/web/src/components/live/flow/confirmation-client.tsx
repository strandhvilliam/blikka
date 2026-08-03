'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'

import { ConfirmationMarathonClient } from './confirmation-marathon-client'
import { ConfirmationByCameraClient } from './confirmation-by-camera-client'

interface ConfirmationClientProps {
  params: {
    participantRef: string
    participantFirstName: string
    participantLastName: string
  }
}

export function ConfirmationClient({ params }: ConfirmationClientProps) {
  const domain = useDomain()
  const trpc = useTRPC()

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  )

  if (marathon.mode === 'by-camera') {
    return <ConfirmationByCameraClient params={params} topics={marathon.topics} />
  }

  // Confetti lives inside the marathon view — it gates on reduced motion there.
  return <ConfirmationMarathonClient params={params} />
}
