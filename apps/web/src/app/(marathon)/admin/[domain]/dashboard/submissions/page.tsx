import { getActiveByCameraTopic } from '@/lib/by-camera/by-camera-active-topic'
import { fetchServerQuery, HydrateClient, prefetch, trpc } from '@/lib/trpc/server'
import { Suspense } from 'react'
import { loadSubmissionSearchParams } from './_lib/search-params'
import { SubmissionsSkeleton } from './_components/submissions-skeleton'
import { SubmissionsContent } from './_components/submissions-content'

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
  const activeByCameraTopicId =
    getActiveByCameraTopic(marathon)?.id ?? (marathon.mode === 'by-camera' ? -1 : null)
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
        <SubmissionsContent />
      </Suspense>
    </HydrateClient>
  )
}
