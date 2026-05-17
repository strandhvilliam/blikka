import { getAppSession } from "@/lib/auth/server"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { StaffHomeClient } from "@/components/staff/staff-home-client"
import { StaffLoadingSkeleton } from "@/components/staff/staff-loading-skeleton"
import { Suspense } from "react"

export default async function StaffDomainPage({ params }: PageProps<"/staff/[domain]">) {
  const { domain } = await params
  const session = await getAppSession()

  if (!session) {
    return <div />
  }

  prefetch(trpc.marathons.getByDomain.queryOptions({ domain }))
  prefetch(
    trpc.users.getVerificationsByStaffId.infiniteQueryOptions(
      {
        staffId: session.user.id,
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
          staffId={session.user.id}
          staffEmail={session.user.email}
          staffImage={session.user.image ?? null}
          staffName={session.user.name ?? session.user.email}
        />
      </Suspense>
    </HydrateClient>
  )}
