import { HydrateClient } from "@/lib/trpc/server"
import { Suspense } from "react"
import { ParticipantContentWrapper } from "./_components/participant-content-wrapper"
import { batchPrefetch, trpc } from "@/lib/trpc/server"
import { ParticipantHeader } from "./_components/participant-header"
import { ParticipantHeaderSkeleton } from "./_components/participant-header-skeleton"
import { ParticipantContentWrapperSkeleton } from "./_components/participant-content-wrapper-skeleton"

export default async function ParticipantsPage({
  params,
}: PageProps<"/admin/[domain]/dashboard/submissions/[participantRef]">) {
  const { domain, participantRef } = await params

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
      <div className="mx-auto max-w-5xl px-6 py-4 space-y-6">
        <Suspense fallback={<ParticipantHeaderSkeleton />}>
          <ParticipantHeader participantRef={participantRef} />
        </Suspense>
        <Suspense fallback={<ParticipantContentWrapperSkeleton />}>
          <ParticipantContentWrapper participantRef={participantRef} />
        </Suspense>
      </div>
    </HydrateClient>
  )
}
