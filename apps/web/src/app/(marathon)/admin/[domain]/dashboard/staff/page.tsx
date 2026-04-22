import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { loadStaffSearchParams } from "./_lib/search-params"
import { StaffDashboard } from "./_components/staff-dashboard"
import { StaffPageSkeleton } from "./_components/staff-page-skeleton"

const _StaffPage = Effect.fn("@blikka/web/StaffPage")(
  function* ({ params, searchParams }: PageProps<"/admin/[domain]/dashboard/staff">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    const queryParams = yield* Effect.tryPromise(() => loadStaffSearchParams(searchParams))

    prefetch(
      trpc.users.getStaffMembersByDomain.queryOptions({
        domain,
      }),
    )

    prefetch(trpc.marathons.getByDomain.queryOptions({ domain }))

    const selectedAccessId = queryParams.access
    if (selectedAccessId != null) {
      prefetch(
        trpc.users.getStaffAccessById.queryOptions({
          accessId: selectedAccessId,
          domain,
        }),
      )
    }

    return (
      <HydrateClient>
        <Suspense fallback={<StaffPageSkeleton />}>
          <StaffDashboard />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_StaffPage)
