import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import {
  fetchEffectQuery,
  HydrateClient,
  prefetch,
  trpc,
} from "@/lib/trpc/server"
import { Suspense } from "react"
import { VotingContent } from "./_components/voting-content"
import { VotingSkeleton } from "./_components/voting-skeleton"

const _VotingPage = Effect.fn("@blikka/web/VotingPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String }),
    )(params)

    const marathon = yield* fetchEffectQuery(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      }),
    )

    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      }),
    )

    if (marathon.mode === "by-camera") {
      const activeTopic = marathon.topics.find(
        (topic) => topic.visibility === "active",
      )
      if (activeTopic) {
        prefetch(
          trpc.voting.getVotingAdminSummary.queryOptions({
            domain,
            topicId: activeTopic.id,
          }),
        )
        prefetch(
          trpc.voting.getVotingLeaderboardPage.queryOptions({
            domain,
            topicId: activeTopic.id,
            page: 1,
            limit: 50,
          }),
        )
      }
    }

    return (
      <HydrateClient>
        <Suspense fallback={<VotingSkeleton />}>
          <div className="container mx-auto flex h-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
            <VotingContent />
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_VotingPage)
