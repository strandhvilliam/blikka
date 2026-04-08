import { getAppSession } from "@/lib/auth/server"
import { Page, decodeParams } from "@/lib/next-utils"
import { Effect, Option, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { StaffHomeClient } from "@/components/staff/staff-home-client"
import { StaffLoadingSkeleton } from "@/components/staff/staff-loading-skeleton"
import { Suspense } from "react"

const _StaffDomainPage = Effect.fn("@blikka/web/StaffDomainPage")(
  function* ({ params }: PageProps<"/staff/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    const session = yield* getAppSession()

    if (Option.isNone(session)) {
      return <div />
    }

    prefetch(trpc.marathons.getByDomain.queryOptions({ domain }))
    prefetch(
      trpc.users.getVerificationsByStaffId.infiniteQueryOptions(
        {
          staffId: session.value.user.id,
          domain,
          limit: 20,
        },
        {
          getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
        },
      ),
    )

    return (
      <HydrateClient>
        <Suspense fallback={<StaffLoadingSkeleton />}>
          <StaffHomeClient
            staffId={session.value.user.id}
            staffEmail={session.value.user.email}
            staffImage={session.value.user.image ?? null}
            staffName={session.value.user.name ?? session.value.user.email}
          />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
)

export default Page(_StaffDomainPage)
