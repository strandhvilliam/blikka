"use client"

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useJuryClientToken } from "../../_components/jury-client-token-provider"
import { useJuryReviewQueryState } from "../_hooks/use-jury-review-query-state"
import { useJurySubmissionsInfiniteQuery } from "../_hooks/use-jury-submissions-infinite-query"
import type { JuryListParticipant } from "../../_lib/jury-types"

export type JuryReviewDataContextValue = {
  participants: JuryListParticipant[]
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetching: boolean
  isFetchingNextPage: boolean
  isPending: boolean
  error: Error | null
  /** Total for the current filter (or full set when unfiltered). */
  totalParticipants: { value: number } | undefined
  /** Count shown in header — full review set when available, else loaded slice. */
  reviewSetTotalParticipants: number
  isFetchingParticipantCount: boolean
}

const JuryReviewDataContext = createContext<JuryReviewDataContextValue | null>(
  null,
)

export function JuryReviewDataProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPC()
  const domain = useDomain()
  const token = useJuryClientToken()
  const { selectedRatings } = useJuryReviewQueryState()

  const { data: reviewSetParticipantCount } = useQuery(
    trpc.jury.getJuryParticipantCount.queryOptions({
      domain,
      token,
    }),
  )

  const {
    data: filteredParticipantCount,
    isFetching: isFetchingParticipantCount,
  } = useQuery(
    trpc.jury.getJuryParticipantCount.queryOptions(
      {
        domain,
        token,
        ratingFilter: selectedRatings.length > 0 ? selectedRatings : undefined,
      },
      {
        placeholderData: keepPreviousData,
      },
    ),
  )

  const totalParticipants = useMemo(
    () =>
      selectedRatings.length > 0
        ? filteredParticipantCount
        : (reviewSetParticipantCount ?? filteredParticipantCount),
    [selectedRatings.length, filteredParticipantCount, reviewSetParticipantCount],
  )

  const {
    participants,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
    error,
  } = useJurySubmissionsInfiniteQuery({
    domain,
    token,
    selectedRatings,
  })

  const reviewSetTotalParticipants = useMemo(
    () =>
      reviewSetParticipantCount?.value ??
      totalParticipants?.value ??
      participants.length,
    [
      reviewSetParticipantCount?.value,
      totalParticipants?.value,
      participants.length,
    ],
  )

  const value = useMemo(
    (): JuryReviewDataContextValue => ({
      participants,
      fetchNextPage,
      hasNextPage,
      isFetching,
      isFetchingNextPage,
      isPending,
      error: error as Error | null,
      totalParticipants,
      reviewSetTotalParticipants,
      isFetchingParticipantCount,
    }),
    [
      participants,
      fetchNextPage,
      hasNextPage,
      isFetching,
      isFetchingNextPage,
      isPending,
      error,
      totalParticipants,
      reviewSetTotalParticipants,
      isFetchingParticipantCount,
    ],
  )

  return (
    <JuryReviewDataContext.Provider value={value}>
      {children}
    </JuryReviewDataContext.Provider>
  )
}

export function useJuryReviewData() {
  const ctx = useContext(JuryReviewDataContext)
  if (!ctx) {
    throw new Error("useJuryReviewData must be used within JuryReviewDataProvider")
  }
  return ctx
}
