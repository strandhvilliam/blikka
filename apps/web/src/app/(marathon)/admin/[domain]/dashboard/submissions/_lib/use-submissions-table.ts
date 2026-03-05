"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { useDebounce } from "use-debounce"
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useQueryStates } from "nuqs"
import { type SortingState } from "@tanstack/react-table"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { submissionSearchParams } from "./search-params"
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
  const activeByCameraTopicId =
    marathon?.mode === "by-camera"
      ? (marathon.topics.find((topic) => topic.visibility === "active")?.id ??
        -1)
      : undefined

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

  const normalizedCompetitionClassId = useMemo(() => {
    if (!competitionClassId || competitionClassId.length === 0)
      return undefined
    return competitionClassId.length === 1
      ? competitionClassId[0]
      : competitionClassId
  }, [competitionClassId])

  const normalizedDeviceGroupId = useMemo(() => {
    if (!deviceGroupId || deviceGroupId.length === 0) return undefined
    return deviceGroupId.length === 1 ? deviceGroupId[0] : deviceGroupId
  }, [deviceGroupId])

  const tabQueryParams = useMemo(() => {
    switch (activeTab) {
      case "all":
        return {
          statusFilter: null,
          excludeStatuses: null,
          hasValidationErrors: null,
        }
      case "initialized":
        return {
          statusFilter: null,
          excludeStatuses: ["completed", "verified"],
          hasValidationErrors: null,
        }
      case "not-verified":
        return {
          statusFilter: "completed" as const,
          excludeStatuses: null,
          hasValidationErrors: null,
        }
      case "verified":
        return {
          statusFilter: "verified" as const,
          excludeStatuses: null,
          hasValidationErrors: null,
        }
      case "validation-errors":
        return {
          statusFilter: null,
          excludeStatuses: null,
          hasValidationErrors: true,
        }
      default:
        return {
          statusFilter: null,
          excludeStatuses: null,
          hasValidationErrors: null,
        }
    }
  }, [activeTab])

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

  const competitionClasses = useMemo(() => {
    const classes = new Map<number, { id: number; name: string }>()
    participants.forEach((p) => {
      if (p.competitionClass) {
        classes.set(p.competitionClass.id, p.competitionClass)
      }
    })
    return Array.from(classes.values())
  }, [participants])

  const deviceGroups = useMemo(() => {
    const groups = new Map<number, { id: number; name: string }>()
    participants.forEach((p) => {
      if (p.deviceGroup) {
        groups.set(p.deviceGroup.id, p.deviceGroup)
      }
    })
    return Array.from(groups.values())
  }, [participants])

  const observerTarget = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleCompetitionClassChange =
    (value: string) => {
      if (value === "all") {
        setQueryState({ competitionClassId: null })
      } else {
        const ids = value.split(",").map(Number)
        setQueryState({ competitionClassId: ids })
      }
    }

  const handleDeviceGroupChange = useCallback(
    (value: string) => {
      if (value === "all") {
        setQueryState({ deviceGroupId: null })
      } else {
        const ids = value.split(",").map(Number)
        setQueryState({ deviceGroupId: ids })
      }
    },
    [setQueryState],
  )

  // Selection helpers
  const selectedCount = selectedIds.size
  const hasSelection = selectedCount > 0

  const toggleSelection =
    (id: number, event: React.MouseEvent) => {
      setSelectedIds((prev) => {
        const newSet = new Set(prev)

        if (event.shiftKey && lastSelectedId !== null) {
          // Range selection with shift key
          const participantIds = participants.map((p) => p.id)
          const lastIndex = participantIds.indexOf(lastSelectedId)
          const currentIndex = participantIds.indexOf(id)

          if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex)
            const end = Math.max(lastIndex, currentIndex)

            for (let i = start; i <= end; i++) {
              newSet.add(participantIds[i]!)
            }
          }
        } else {
          // Single toggle
          if (newSet.has(id)) {
            newSet.delete(id)
          } else {
            newSet.add(id)
          }
        }

        return newSet
      })

      // Update last selected if not shift-click
      if (!event.shiftKey) {
        setLastSelectedId(id)
      }
    }

  const isSelected = (id: number) => selectedIds.has(id)

  const clearSelection = () => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const visibleIds = participants.map((p) => p.id)
      const allVisibleSelected = visibleIds.every((id) => prev.has(id))

      if (allVisibleSelected) {
        const newSet = new Set(prev)
        visibleIds.forEach((id) => newSet.delete(id))
        return newSet
      } else {
        const newSet = new Set(prev)
        visibleIds.forEach((id) => newSet.add(id))
        return newSet
      }
    })
  }

  const canVerifySelected = useMemo(() => {
    if (selectedCount === 0) return false
    return Array.from(selectedIds).every((id) => {
      const participant = participants.find((p) => p.id === id)
      return participant?.status === "completed"
    })
  }, [selectedIds, participants, selectedCount])

  return {
    domain,
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
    // Selection state
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
