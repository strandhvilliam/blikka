import { Effect, Schema } from "effect"
import { decodeParams, Page } from "@/lib/next-utils"
import { HydrateClient } from "@/lib/trpc/server"
import { Suspense } from "react"
import { ParticipantSubmissionClientPage } from "./_components/client-page"
import { batchPrefetch, trpc } from "@/lib/trpc/server"

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
        <Suspense fallback={<div>Loading...</div>}>
          <ParticipantSubmissionClientPage />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_ParticipantsPage)
