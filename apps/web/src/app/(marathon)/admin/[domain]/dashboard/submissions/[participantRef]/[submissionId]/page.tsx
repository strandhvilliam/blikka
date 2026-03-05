import { Effect, Schema } from "effect"
import { decodeParams, Page } from "@/lib/next-utils"
import { HydrateClient } from "@/lib/trpc/server"
import { Suspense } from "react"
import { batchPrefetch, trpc } from "@/lib/trpc/server"
import { ParticipantSubmissionClientPage } from "./_components/client-page"
import { SubmissionPageSkeleton } from "./_components/submission-page-skeleton"

const _ParticipantSubmissionPage = Effect.fn("@blikka/web/ParticipantSubmissionPage")(
  function*({ params }: PageProps<"/admin/[domain]/dashboard/submissions/[participantRef]/[submissionId]">) {
    const { domain, participantRef, submissionId } = yield* decodeParams(
      Schema.Struct({
        domain: Schema.String,
        participantRef: Schema.String,
        submissionId: Schema.String,
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
        <Suspense fallback={<SubmissionPageSkeleton />}>
          <ParticipantSubmissionClientPage
            participantRef={participantRef}
            submissionId={Number(submissionId)}
          />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_ParticipantSubmissionPage)
