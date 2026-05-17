import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { LiveClientPage } from "@/components/live/live-client-page"
import { Splash } from "@/components/splash"

export default async function LivePage({ params }: PageProps<"/live/[domain]">) {
  const { domain } = await params
  prefetch(trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }))

  return (
    <HydrateClient>
      <Suspense fallback={<Splash />}>
        <LiveClientPage />
      </Suspense>
    </HydrateClient>
  )
}
