import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import {
  HydrateClient,
  prefetch,
  trpc,
} from "@/lib/trpc/server"
import { Suspense } from "react"
import { DashboardHomeContent } from "./_components/dashboard-home-content"
import { DashboardHomeSkeleton } from "./_components/dashboard-home-skeleton"

const _DashboardPage = Effect.fn("@blikka/web/DashboardPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      }),
    )

    return (
      <HydrateClient>
        <Suspense fallback={<DashboardHomeSkeleton />}>
          <DashboardHomeContent />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_DashboardPage)
