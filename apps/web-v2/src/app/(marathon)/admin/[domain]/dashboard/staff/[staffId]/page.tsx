import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { prefetch, HydrateClient, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { StaffDetailsContent } from "./_components/staff-details-content"
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

    // Prefetch first page of verifications with infinite query
    prefetch(
      trpc.users.getVerificationsByStaffId.infiniteQueryOptions(
        {
          staffId,
          domain,
          limit: 20,
        },
        {
          getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
        }
      )
    )

    prefetch(
      trpc.marathons.getByDomain.queryOptions({
        domain,
      })
    )

    return (
      <HydrateClient>
        <Suspense fallback={<StaffDetailsSkeleton />}>
          <StaffDetailsContent staffId={staffId} />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_StaffDetailsPage)
