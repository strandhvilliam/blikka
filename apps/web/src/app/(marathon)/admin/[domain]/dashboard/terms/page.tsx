import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, batchPrefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { TermsSkeleton } from "./_components/terms-skeleton"
import { TermsContent } from "./_components/terms-content"

const _TermsPage = Effect.fn("@blikka/web/TermsPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

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
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_TermsPage)
