import { HydrateClient, batchPrefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { TermsSkeleton } from "./_components/terms-skeleton"
import { TermsContent } from "./_components/terms-content"

export default async function TermsPage({ params }: PageProps<"/admin/[domain]/dashboard">) {
  const { domain } = await params

  batchPrefetch([
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
    trpc.marathons.getCurrentTerms.queryOptions({
      domain,
    }),
  ])

  return (
    <HydrateClient>
      <Suspense fallback={<TermsSkeleton />}>
        <div className="mx-auto w-full max-w-4xl px-6 py-4">
          <TermsContent />
        </div>
      </Suspense>
    </HydrateClient>
  )
}
