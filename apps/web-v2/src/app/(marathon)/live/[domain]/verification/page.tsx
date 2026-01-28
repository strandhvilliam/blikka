import { decodeParams } from "@/lib/next-utils"
import { Suspense } from "react"
import { Effect, Schema } from "effect"
import { HydrateClient } from "@/lib/trpc/server"
import { Page } from "@/lib/next-utils"
import { prefetch, trpc } from "@/lib/trpc/server"
import { Splash } from "@/components/splash";

const _VerificationPage = Effect.fn("@blikka/web/VerificationPage")(
  function*({ params }: PageProps<"/live/[domain]/verification">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }))
    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <div>Verification</div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) =>
    Effect.succeed(<div>Error: {error instanceof Error ? error.message : String(error)}</div>)
  )
)

export default Page(_VerificationPage)
