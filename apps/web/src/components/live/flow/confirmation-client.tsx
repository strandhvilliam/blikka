'use client'

import dynamic from 'next/dynamic'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'

import { ConfirmationMarathonClient } from './confirmation-marathon-client'
import { ConfirmationByCameraClient } from './confirmation-by-camera-client'

const Confetti = dynamic(() => import('react-confetti').then((mod) => mod.default), {
  ssr: false,
})

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

  return (
    <>
      <Confetti recycle={false} numberOfPieces={400} />
      <ConfirmationMarathonClient params={params} />
    </>
  )
}
