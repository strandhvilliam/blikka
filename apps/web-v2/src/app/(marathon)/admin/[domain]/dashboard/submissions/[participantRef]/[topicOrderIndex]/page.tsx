import { Effect, Schema } from "effect"
import { decodeParams, Page } from "@/lib/next-utils"
import { HydrateClient } from "@/lib/trpc/server"
import { Suspense } from "react"
import { batchPrefetch, trpc } from "@/lib/trpc/server"
import { ParticipantTopicSubmissionClientPage } from "./_components/client-page"

const _ParticipantTopicSubmissionPage = Effect.fn("@blikka/web/TopicSubmissionsPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain, participantRef, topicOrderIndex } = yield* decodeParams(
      Schema.Struct({
        domain: Schema.String,
        participantRef: Schema.String,
        topicOrderIndex: Schema.NumberFromString,
      })
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
          <ParticipantTopicSubmissionClientPage
            participantRef={participantRef}
            topicOrderIndex={topicOrderIndex}
          />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_ParticipantTopicSubmissionPage)
