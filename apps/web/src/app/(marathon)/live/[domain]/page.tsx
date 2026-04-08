import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { LiveClientPage } from "@/components/live/live-client-page"
import { Splash } from "@/components/splash"

const _LivePage = Effect.fn("@blikka/web/LivePage")(
  function* ({ params }: PageProps<"/live/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }))

    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <LiveClientPage />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) =>
    Effect.succeed(<div>Error: {error instanceof Error ? error.message : String(error)}</div>)
  )
)

export default Page(_LivePage)
