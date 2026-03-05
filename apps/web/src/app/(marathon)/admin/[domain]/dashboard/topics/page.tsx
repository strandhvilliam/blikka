import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { TopicsSkeleton } from "./_components/topics-skeleton"
import { TopicsContent } from "./_components/topics-content"

const _TopicsPage = Effect.fn("@blikka/web/TopicsPage")(
  function* ({ params, searchParams }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      })
    )
    prefetch(
      trpc.topics.getWithSubmissionCount.queryOptions({
        domain,
      })
    )

    return (
      <HydrateClient>
        <Suspense fallback={<TopicsSkeleton />}>
          <div className="container mx-auto h-full flex flex-col">
            <TopicsContent />
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_TopicsPage)
