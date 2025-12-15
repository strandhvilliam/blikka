import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { ClientPage } from "./client-page"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"

const _LivePage = Effect.fn("@blikka/web/LivePage")(
  function* ({ params }: PageProps<"/live/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }))
    return (
      <HydrateClient>
        <Suspense fallback={<div>Loading...</div>}>
          <ClientPage domain={domain} />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) =>
    Effect.succeed(<div>Error: {error instanceof Error ? error.message : String(error)}</div>)
  )
)

export default Page(_LivePage)
