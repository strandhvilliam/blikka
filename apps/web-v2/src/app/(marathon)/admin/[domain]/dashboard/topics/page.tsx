import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { TopicsHeader } from "./_components/topics-header"
import { TopicsTable } from "./_components/topics-table"
import { TopicsSkeleton } from "./_components/topics-skeleton"

const _TopicsPage = Effect.fn("@blikka/web/TopicsPage")(
  function* ({ params, searchParams }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      })
    )

    return (
      <HydrateClient>
        <Suspense fallback={<TopicsSkeleton />}>
          <div className="container mx-auto h-full flex flex-col">
            <div className="shrink-0 mb-6">
              <TopicsHeader />
            </div>
            <div className="flex-1 min-h-0">
              <TopicsTable />
            </div>
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_TopicsPage)
