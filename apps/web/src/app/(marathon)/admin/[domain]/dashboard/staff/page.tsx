import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server'
import { Suspense } from 'react'
import { loadStaffSearchParams } from './_lib/search-params'
import { StaffDashboard } from './_components/staff-dashboard'
import { StaffPageSkeleton } from './_components/staff-page-skeleton'

export default async function StaffPage({
  params,
  searchParams,
}: PageProps<'/admin/[domain]/dashboard/staff'>) {
  const { domain } = await params
  const queryParams = await loadStaffSearchParams(searchParams)

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
}
