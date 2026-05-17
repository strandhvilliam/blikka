import { getAppSession } from "@/lib/auth/server"
import { Option } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { StaffHomeClient } from "@/components/staff/staff-home-client"
import { StaffLoadingSkeleton } from "@/components/staff/staff-loading-skeleton"
import { Suspense } from "react"
import { serverRuntime } from "@/lib/server-runtime"

export default async function StaffDomainPage({ params }: PageProps<"/staff/[domain]">) {
  const { domain } = await params
  const session = await serverRuntime.runPromise(getAppSession())

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
  )}
