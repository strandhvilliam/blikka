import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { TopicsSkeleton } from "./_components/topics-skeleton"
import { TopicsContent } from "./_components/topics-content"

const _TopicsPage = Effect.fn("@blikka/web/TopicsPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      }),
    )
    prefetch(
      trpc.topics.getWithSubmissionCount.queryOptions({
        domain,
      }),
    )

    return (
      <HydrateClient>
        <Suspense fallback={<TopicsSkeleton />}>
          <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
              <TopicsContent />
            </div>
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_TopicsPage)
