import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { prefetch, HydrateClient, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { StaffDetailsContent } from "./_components/staff-details-content"
import { StaffDetailsSkeleton } from "./_components/staff-details-skeleton"

const _StaffDetailsPage = Effect.fn("@blikka/web/StaffDetailsPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard/staff/[accessId]">) {
    const { domain, accessId } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, accessId: Schema.String })
    )(params)

    prefetch(
      trpc.users.getStaffAccessById.queryOptions({
        accessId,
        domain,
      })
    )

    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      })
    )

    return (
      <HydrateClient>
        <Suspense fallback={<StaffDetailsSkeleton />}>
          <StaffDetailsContent accessId={accessId} />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_StaffDetailsPage)
