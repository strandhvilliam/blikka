'use client'

import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { getActiveByCameraTopic } from '@/lib/by-camera/by-camera-active-topic'
import { getTabQueryParams, normalizeSubmissionTabForMode } from '../_lib/submissions-tabs'
import { useSubmissionsQueryState } from './use-submissions-query-state'
import type { SubmissionTableRow, SubmissionsMarathon } from '../_lib/submissions-types'

const PARTICIPANTS_PAGE_SIZE = 50

interface UseSubmissionsQueryInput {
  marathon: SubmissionsMarathon
}

export function useSubmissionsQuery({ marathon }: UseSubmissionsQueryInput) {
  const domain = useDomain()
  const trpc = useTRPC()
  const participantsQueryPathKey = useMemo(
    () => trpc.participants.getByDomainInfinite.pathKey(),
    [trpc],
  )
  const {
    queryState,
    setQueryState,
    debouncedSearch,
    normalizedCompetitionClassId,
    normalizedDeviceGroupId,
    handleCompetitionClassChange,
    handleDeviceGroupChange,
  } = useSubmissionsQueryState()

  const normalizedTab = normalizeSubmissionTabForMode(queryState.tab, marathon.mode)
  const tabQueryParams = getTabQueryParams(normalizedTab)

  const activeByCameraTopicId =
    getActiveByCameraTopic(marathon)?.id ?? (marathon.mode === 'by-camera' ? -1 : null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery(
      trpc.participants.getByDomainInfinite.infiniteQueryOptions(
        {
          domain,
          cursor: null,
          search: debouncedSearch || null,
          sortOrder: queryState.sortOrder || null,
          competitionClassId: normalizedCompetitionClassId ?? null,
          deviceGroupId: normalizedDeviceGroupId ?? null,
          topicId: activeByCameraTopicId,
          statusFilter: tabQueryParams.statusFilter,
          excludeStatuses: tabQueryParams.excludeStatuses,
          includeStatuses: tabQueryParams.includeStatuses ?? null,
          hasValidationErrors: tabQueryParams.hasValidationErrors,
          votedFilter: tabQueryParams.votedFilter ?? null,
          limit: PARTICIPANTS_PAGE_SIZE,
        },
        {
          getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
        },
      ),
    )

  const participants = useMemo(
    () => (data?.pages.flatMap((page) => page.participants) ?? []) as SubmissionTableRow[],
    [data],
  )

  const observerTarget = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchNextPage,
  })

  return {
    queryState,
    setQueryState,
    normalizedTab,
    participants,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    observerTarget,
    handleCompetitionClassChange,
    handleDeviceGroupChange,
    participantsQueryPathKey,
  }
}
