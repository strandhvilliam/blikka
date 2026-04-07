import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { loadJurySearchParams } from "./_lib/search-params"
import { JuryDashboard } from "./_components/jury-dashboard"
import { JuryPageSkeleton } from "./_components/jury-page-skeleton"

const _JuryPage = Effect.fn("@blikka/web/JuryPage")(
  function* ({ params, searchParams }: PageProps<"/admin/[domain]/dashboard/jury">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    const queryParams = yield* Effect.tryPromise(() => loadJurySearchParams(searchParams))

    prefetch(
      trpc.jury.getJuryInvitationsByDomain.queryOptions({
        domain,
      }),
    )

    prefetch(trpc.marathons.getByDomain.queryOptions({ domain }))

    const selectedId = queryParams.invitation
    if (selectedId != null) {
      prefetch(
        trpc.jury.getJuryInvitationById.queryOptions({
          id: selectedId,
        }),
      )
      prefetch(
        trpc.jury.getJuryReviewResultsByInvitationId.queryOptions({
          id: selectedId,
        }),
      )
    }

    return (
      <HydrateClient>
        <Suspense fallback={<JuryPageSkeleton />}>
          <JuryDashboard />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_JuryPage)
