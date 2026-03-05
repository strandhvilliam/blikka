import { Effect, Schema } from "effect"
import { decodeParams, Page } from "@/lib/next-utils"
import { HydrateClient } from "@/lib/trpc/server"
import { Suspense } from "react"
import { ParticipantContentWrapper } from "./_components/participant-content-wrapper"
import { batchPrefetch, trpc } from "@/lib/trpc/server"
import { ParticipantHeader } from "./_components/participant-header"
import { ParticipantHeaderSkeleton } from "./_components/participant-header-skeleton"
import { ParticipantContentWrapperSkeleton } from "./_components/participant-content-wrapper-skeleton"

const _ParticipantsPage = Effect.fn("@blikka/web/ParticipantSubmissionsPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain, participantRef } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, participantRef: Schema.String })
    )(params)

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
        <div className="container mx-auto space-y-6">
          <Suspense fallback={<ParticipantHeaderSkeleton />}>
            <ParticipantHeader participantRef={participantRef} />
          </Suspense>
          <Suspense fallback={<ParticipantContentWrapperSkeleton />}>
            <ParticipantContentWrapper participantRef={participantRef} />
          </Suspense>
        </div>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_ParticipantsPage)
