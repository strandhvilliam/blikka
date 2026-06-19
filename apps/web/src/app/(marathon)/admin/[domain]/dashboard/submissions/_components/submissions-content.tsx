'use client'

import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'
import { SubmissionsHeader } from './submissions-header'
import { SubmissionsTable } from './submissions-table'

export function SubmissionsContent() {
  const domain = useDomain()
  const trpc = useTRPC()
  const [realtimeEnabled, setRealtimeEnabled] = useState(true)
  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  return (
    <div className="mx-auto w-full max-w-[1440px] h-full flex flex-col px-4 py-3 sm:px-6 sm:py-4">
      <div className="shrink-0 mb-4 sm:mb-6">
        <SubmissionsHeader
          marathon={marathon}
          realtimeEnabled={realtimeEnabled}
          onRealtimeEnabledChange={setRealtimeEnabled}
        />
      </div>
      <div className="flex-1 min-h-0 ">
        <SubmissionsTable marathon={marathon} realtimeEnabled={realtimeEnabled} />
      </div>
    </div>
  )
}
