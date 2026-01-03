import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { prefetch, HydrateClient, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { StaffDetailsClient } from "./_components/staff-details-client"
import { StaffDetailsSkeleton } from "./_components/staff-details-skeleton"

const _StaffDetailsPage = Effect.fn("@blikka/web/StaffDetailsPage")(
  function* ({ params }: PageProps<"/admin/[domain]/dashboard/staff/[staffId]">) {
    const { domain, staffId } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, staffId: Schema.String })
    )(params)

    prefetch(
      trpc.users.getStaffMemberById.queryOptions({
        staffId,
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
          <StaffDetailsClient staffId={staffId} />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_StaffDetailsPage)
