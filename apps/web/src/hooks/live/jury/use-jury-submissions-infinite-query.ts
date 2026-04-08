"use client"

import { useMemo } from "react"
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { getJurySubmissionsNextPageParam } from "@/lib/jury/jury-utils"
import type { JuryListParticipant } from "@/lib/jury/jury-types"

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
          // @ts-expect-error - TODO: fix this
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
