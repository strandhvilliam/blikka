import { decodeParams } from "@/lib/next-utils"
import { Suspense } from "react"
import { Effect, Schema } from "effect"
import { HydrateClient } from "@/lib/trpc/server"
import { FlowClientWrapper } from "./_components/flow-client-wrapper"
import { Page } from "@/lib/next-utils"
import { prefetch, trpc } from "@/lib/trpc/server"

const _FlowPage = Effect.fn("@blikka/web/FlowPage")(
  function* ({ params }: PageProps<"/live/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }))
    return (
      <HydrateClient>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div>Loading...</div></div>}>
          <FlowClientWrapper />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) =>
    Effect.succeed(<div>Error: {error instanceof Error ? error.message : String(error)}</div>)
  )
)

export default Page(_FlowPage)
