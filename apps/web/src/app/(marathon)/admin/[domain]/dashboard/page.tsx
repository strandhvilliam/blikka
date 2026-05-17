import { HydrateClient, prefetch, trpc } from '@/lib/trpc/server'
import { Suspense } from 'react'
import { DashboardHomeContent } from './_components/dashboard-home-content'
import { DashboardHomeSkeleton } from './_components/dashboard-home-skeleton'

export default async function DashboardPage({ params }: PageProps<'/admin/[domain]/dashboard'>) {
  const { domain } = await params

  prefetch(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  return (
    <HydrateClient>
      <Suspense fallback={<DashboardHomeSkeleton />}>
        <DashboardHomeContent />
      </Suspense>
    </HydrateClient>
  )
}
