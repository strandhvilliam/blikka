"use client"

import { useCallback, useMemo, useState } from "react"
import { useDebounce } from "use-debounce"
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useQueryStates } from "nuqs"
import { type SortingState } from "@tanstack/react-table"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { submissionSearchParams } from "../_lib/search-params"
import {
  getTabQueryParams,
  normalizeIdArray,
} from "../_lib/submissions-table-utils"
import type { Participant, CompetitionClass, DeviceGroup } from "@blikka/db"

export type TableData = Omit<Participant, "phoneEncrypted" | "phoneHash"> & {
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
  activeTopicSubmissionId: number | null
  failedValidationResults: { errors: number; warnings: number }
  passedValidationResults: { errors: number; warnings: number }
  skippedValidationResults: { errors: number; warnings: number }
  zipKeys: string[]
  contactSheetKeys: string[]
  votingSession: { votedAt: string | null } | null
}

export function useSubmissionsTable() {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  )

  const [sorting, setSorting] = useState<SortingState>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null)
  const [queryState, setQueryState] = useQueryStates(submissionSearchParams, {
    history: "push",
  })

  const {
    tab: activeTab,
    search,
    sortOrder,
    competitionClassId,
    deviceGroupId,
  } = queryState
  const [debouncedSearch] = useDebounce(search || "", 300)

  const activeByCameraTopicId =
    marathon?.mode === "by-camera"
      ? (marathon.topics.find((topic) => topic.visibility === "active")?.id ??
        -1)
      : undefined

  const tabQueryParams = useMemo(
    () => getTabQueryParams(activeTab),
    [activeTab],
  )
  const normalizedCompetitionClassId = useMemo(
    () => normalizeIdArray(competitionClassId),
    [competitionClassId],
  )
  const normalizedDeviceGroupId = useMemo(
    () => normalizeIdArray(deviceGroupId),
    [deviceGroupId],
  )

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery(
    trpc.participants.getByDomainInfinite.infiniteQueryOptions(
      {
        domain,
        cursor: null,
        search: debouncedSearch || null,
        sortOrder: sortOrder || null,
        competitionClassId: normalizedCompetitionClassId ?? null,
        deviceGroupId: normalizedDeviceGroupId ?? null,
        topicId: activeByCameraTopicId ?? null,
        statusFilter: tabQueryParams.statusFilter,
        excludeStatuses: tabQueryParams.excludeStatuses,
        hasValidationErrors: tabQueryParams.hasValidationErrors,
        votedFilter: tabQueryParams.votedFilter ?? null,
        limit: 50,
      },
      {
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
      },
    ),
  )

  const participants = useMemo(
    () =>
      (data?.pages.flatMap((page) => page.participants) ?? []) as TableData[],
    [data],
  )

  const competitionClasses = marathon?.competitionClasses ?? []
  const deviceGroups = marathon?.deviceGroups ?? []

  const observerTarget = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchNextPage,
  })

  const handleCompetitionClassChange = useCallback(
    (value: string) => {
      setQueryState({
        competitionClassId: value === "all" ? null : value.split(",").map(Number),
      })
    },
    [setQueryState],
  )
  const handleDeviceGroupChange = useCallback(
    (value: string) => {
      setQueryState({
        deviceGroupId: value === "all" ? null : value.split(",").map(Number),
      })
    },
    [setQueryState],
  )

  const selectedCount = selectedIds.size
  const hasSelection = selectedCount > 0

  const toggleSelection = useCallback(
    (id: number, event: React.MouseEvent) => {
      setSelectedIds((prev) => {
        const newSet = new Set(prev)

        if (event.shiftKey && lastSelectedId !== null) {
          const participantIds = participants.map((p) => p.id)
          const lastIndex = participantIds.indexOf(lastSelectedId)
          const currentIndex = participantIds.indexOf(id)

          if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex)
            const end = Math.max(lastIndex, currentIndex)
            for (let i = start; i <= end; i++) {
              const participantId = participantIds[i]
              if (participantId !== undefined) newSet.add(participantId)
            }
          }
        } else {
          if (newSet.has(id)) {
            newSet.delete(id)
          } else {
            newSet.add(id)
          }
        }

        return newSet
      })

      if (!event.shiftKey) {
        setLastSelectedId(id)
      }
    },
    [lastSelectedId, participants],
  )

  const isSelected = useCallback(
    (id: number) => selectedIds.has(id),
    [selectedIds],
  )

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }, [])

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const visibleIds = participants.map((p) => p.id)
      const allVisibleSelected = visibleIds.every((id) => prev.has(id))
      const newSet = new Set(prev)

      if (allVisibleSelected) {
        visibleIds.forEach((id) => newSet.delete(id))
      } else {
        visibleIds.forEach((id) => newSet.add(id))
      }
      return newSet
    })
  }, [participants])

  const canVerifySelected = useMemo(() => {
    if (selectedCount === 0) return false
    return Array.from(selectedIds).every((id) => {
      const participant = participants.find((p) => p.id === id)
      return participant?.status === "completed"
    })
  }, [selectedIds, participants, selectedCount])

  return {
    marathon,
    sorting,
    setSorting,
    queryState,
    setQueryState,
    participants,
    competitionClasses,
    deviceGroups,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    observerTarget,
    handleCompetitionClassChange,
    handleDeviceGroupChange,
    selectedIds,
    selectedCount,
    hasSelection,
    toggleSelection,
    toggleAllVisible,
    isSelected,
    clearSelection,
    canVerifySelected,
  }
}
