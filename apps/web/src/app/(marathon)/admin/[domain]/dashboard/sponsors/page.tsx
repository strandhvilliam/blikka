import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { SponsorsSkeleton } from "./_components/sponsors-skeleton"
import { SponsorsContent } from "./_components/sponsors-content"

const _SponsorsPage = Effect.fn("@blikka/web/SponsorsPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    prefetch(
      trpc.sponsors.getByMarathon.queryOptions({
        domain,
      })
    )

    return (
      <HydrateClient>
        <Suspense fallback={<SponsorsSkeleton />}>
          <div className="mx-auto max-w-4xl px-6 py-8 lg:py-10">
            <SponsorsContent />
          </div>
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_SponsorsPage)
