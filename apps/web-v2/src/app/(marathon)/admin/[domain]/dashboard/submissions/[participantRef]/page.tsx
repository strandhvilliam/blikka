import { Effect, Schema } from "effect"
import { decodeParams, Page } from "@/lib/next-utils"
import { HydrateClient } from "@/lib/trpc/server"
import { Suspense } from "react"
import { ParticipantSubmissionClientPage } from "./_components/client-page"
import { batchPrefetch, trpc } from "@/lib/trpc/server"
import { ParticipantHeader } from "./_components/participant-header"
import { ParticipantHeaderSkeleton } from "./_components/participant-header-skeleton"
import { ParticipantSubmissionClientPageSkeleton } from "./_components/client-page-skeleton"

const _ParticipantsPage = Effect.fn("@blikka/web/ParticipantSubmissionsPage")(
  function* ({ params, searchParams }: PageProps<"/admin/[domain]/dashboard">) {
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
            <ParticipantHeader />
          </Suspense>
          <Suspense fallback={<ParticipantSubmissionClientPageSkeleton />}>
            <ParticipantSubmissionClientPage />
          </Suspense>
        </div>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_ParticipantsPage)
