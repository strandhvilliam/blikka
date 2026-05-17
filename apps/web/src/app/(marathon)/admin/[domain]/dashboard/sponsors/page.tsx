import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { SponsorsSkeleton } from "./_components/sponsors-skeleton"
import { SponsorsContent } from "./_components/sponsors-content"

export default async function SponsorsPage({ params }: PageProps<"/admin/[domain]/dashboard">) {
  const { domain } = await params

  prefetch(
    trpc.sponsors.getByMarathon.queryOptions({
      domain,
    }),
  )

  return (
    <HydrateClient>
      <Suspense fallback={<SponsorsSkeleton />}>
        <div className="mx-auto w-full max-w-4xl px-6 py-4">
          <SponsorsContent />
        </div>
      </Suspense>
    </HydrateClient>
  )
}
