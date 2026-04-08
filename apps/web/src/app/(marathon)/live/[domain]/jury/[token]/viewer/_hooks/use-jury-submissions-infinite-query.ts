"use client"

import { useMemo } from "react"
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { getJurySubmissionsNextPageParam } from "../../_lib/jury-utils"
import type { JuryListParticipant } from "../../_lib/jury-types"

export function useJurySubmissionsInfiniteQuery({
  domain,
  token,
  selectedRatings,
}: {
  domain: string
  token: string
  selectedRatings: number[]
}) {
  const trpc = useTRPC()
  const ratingFilter = selectedRatings.length > 0 ? selectedRatings : undefined

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isPending, error } =
    useInfiniteQuery(
      trpc.jury.getJurySubmissionsFromToken.infiniteQueryOptions(
        { domain, token, ratingFilter },
        {
          getNextPageParam: getJurySubmissionsNextPageParam,
          placeholderData: keepPreviousData,
        },
      ),
    )

  const participants = useMemo(
    () => (data?.pages ?? []).flatMap((page) => page.participants) as JuryListParticipant[],
    [data?.pages],
  )

  return {
    participants,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetching,
    isFetchingNextPage,
    isPending,
    error,
  }
}
