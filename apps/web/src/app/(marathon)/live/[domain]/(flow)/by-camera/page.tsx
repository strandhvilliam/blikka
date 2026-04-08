import { decodeParams } from "@/lib/next-utils"
import { Suspense } from "react"
import { Effect, Schema } from "effect"
import { HydrateClient } from "@/lib/trpc/server"
import { Page } from "@/lib/next-utils"
import { prefetch, trpc } from "@/lib/trpc/server"
import { StepStateProvider } from "@/lib/flow/step-state-context"
import { Splash } from "@/components/splash"
import { ByCameraClientWrapper } from "@/components/live/flow/by-camera-client-wrapper"

const _ByCameraPage = Effect.fn("@blikka/web/ByCameraPage")(
  function* ({ params }: PageProps<"/live/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }))
    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <StepStateProvider flowMode="by-camera">
            <ByCameraClientWrapper />
          </StepStateProvider>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) =>
    Effect.succeed(<div>Error: {error instanceof Error ? error.message : String(error)}</div>),
  ),
)

export default Page(_ByCameraPage)
