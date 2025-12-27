import { Effect, Schema } from "effect"
import { decodeParams, Page } from "@/lib/next-utils"
import { HydrateClient } from "@/lib/trpc/server"
import { Suspense } from "react"
import { ParticipantSubmissionClientPage } from "./_components/client-page"
import { batchPrefetch, trpc } from "@/lib/trpc/server"
import { ParticipantHeader } from "./_components/participant-header"

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
        <Suspense
          fallback={
            <div className="container mx-auto flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                <span className="text-sm text-muted-foreground">Loading participant data...</span>
              </div>
            </div>
          }
        >
          <div className="container mx-auto space-y-6">
            <ParticipantHeader />
            <ParticipantSubmissionClientPage />
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_ParticipantsPage)
