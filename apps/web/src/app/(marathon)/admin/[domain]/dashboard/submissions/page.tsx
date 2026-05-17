import { fetchServerQuery, HydrateClient, prefetch, trpc } from '@/lib/trpc/server'
import { SubmissionsTable } from './_components/submissions-table'
import { Suspense } from 'react'
import { loadSubmissionSearchParams } from './_lib/search-params'
import { SubmissionsHeader } from './_components/submissions-header'
import { SubmissionsSkeleton } from './_components/submissions-skeleton'

export default async function SubmissionsPage({
  params,
  searchParams,
}: PageProps<'/admin/[domain]/dashboard'>) {
  const { domain } = await params
  const marathon = await fetchServerQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )
  const activeByCameraTopic =
    marathon.mode === 'by-camera'
      ? (marathon.topics.find((topic) => topic.visibility === 'active') ?? null)
      : null
  const activeByCameraTopicId =
    marathon.mode === 'by-camera' ? (activeByCameraTopic?.id ?? -1) : null
  const queryParams = await loadSubmissionSearchParams(searchParams)
  prefetch(
    trpc.participants.getByDomainInfinite.queryOptions({
      domain,
      cursor: null,
      limit: 50,
      search: queryParams.search,
      sortOrder: queryParams.sortOrder,
      competitionClassId: queryParams.competitionClassId,
      deviceGroupId: queryParams.deviceGroupId,
      topicId: activeByCameraTopicId,
      statusFilter: null,
      excludeStatuses: null,
      hasValidationErrors: null,
      includeStatuses: null,
      votedFilter: null,
    }),
  )

  return (
    <HydrateClient>
      <Suspense fallback={<SubmissionsSkeleton />}>
        <div className="mx-auto w-full max-w-[1440px] h-full flex flex-col px-4 py-3 sm:px-6 sm:py-4">
          <div className="shrink-0 mb-4 sm:mb-6">
            <SubmissionsHeader />
          </div>
          <div className="flex-1 min-h-0 ">
            <SubmissionsTable />
          </div>
        </div>
      </Suspense>
    </HydrateClient>
  )
}
