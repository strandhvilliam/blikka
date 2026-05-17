import { Suspense } from "react"
import { HydrateClient } from "@/lib/trpc/server"

import { prefetch, trpc } from "@/lib/trpc/server"
import { StepStateProvider } from "@/lib/flow/step-state-context"
import { Splash } from "@/components/splash"
import { ByCameraClientWrapper } from "@/components/live/flow/by-camera-client-wrapper"

export default async function ByCameraPage({ params }: PageProps<"/live/[domain]">) {
  const { domain } = await params
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
}
