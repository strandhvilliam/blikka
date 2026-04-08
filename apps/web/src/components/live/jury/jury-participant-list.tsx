"use client"

import { useEffect, useRef, useMemo, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Grid2x2, List, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useTRPC } from "@/lib/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useDomain } from "@/lib/domain-provider"
import { useJuryClientToken } from "./jury-client-token-provider"
import type { JuryListParticipant, ViewMode } from "@/app/(marathon)/live/[domain]/jury/[token]/_lib/jury-types"
import { useJuryReviewQueryState } from "@/app/(marathon)/live/[domain]/jury/[token]/viewer/_hooks/use-jury-review-query-state"
import { useJuryReviewData } from "./jury-review-data-provider"
import { JuryParticipantCard } from "./jury-participant-card"
import { RatingFilterBar } from "./rating-filter"
const COMPACT_ROW_HEIGHT = 68
const GRID_ROW_HEIGHT = 260
const GAP = 12

/** Aligns first client paint with SSR so query hydration cannot toggle `isPending` mid-hydration. */
function useIsClientMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}

/** SSR-safe: same count on server and first client paint; refine after mount. */
function useGridColumnCount(viewMode: ViewMode) {
  const [columnCount, setColumnCount] = useState(3)

  useEffect(() => {
    if (viewMode !== "grid") return

    const update = () => {
      const width = window.innerWidth
      if (width >= 1280) setColumnCount(5)
      else if (width >= 1024) setColumnCount(4)
      else if (width >= 640) setColumnCount(3)
      else setColumnCount(2)
    }

    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [viewMode])

  return viewMode === "compact" ? 1 : columnCount
}

export function JuryParticipantList({
  isRefreshingResults,
}: {
  isRefreshingResults: boolean
}) {
  const {
    participants,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending: isPendingParticipants,
    totalParticipants,
    error,
  } = useJuryReviewData()
  const isClientMounted = useIsClientMounted()
  const { viewMode, selectedRatings, selectParticipant } =
    useJuryReviewQueryState()
  const domain = useDomain()
  const token = useJuryClientToken()
  const trpc = useTRPC()
  const { data: ratingsData } = useSuspenseQuery(
    trpc.jury.getJuryRatingsByInvitation.queryOptions({ domain, token }),
  )
  const ratingByParticipantId = useMemo(
    () =>
      new Map(
        ratingsData.ratings.map(
          (rating) => [rating.participantId, rating] as const,
        ),
      ),
    [ratingsData.ratings],
  )
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const totalMatchingParticipants =
    totalParticipants?.value ?? participants.length
  const participantSummary =
    participants.length < totalMatchingParticipants
      ? `Showing ${participants.length} of ${totalMatchingParticipants} participants`
      : `${totalMatchingParticipants} participants`

  const gridCols = useGridColumnCount(viewMode)

  const rows = useMemo(() => {
    if (viewMode === "compact") {
      return participants.map((p, i) => ({ participants: [{ participant: p, index: i }] }))
    }
    const result: { participants: { participant: JuryListParticipant; index: number }[] }[] = []
    for (let i = 0; i < participants.length; i += gridCols) {
      const row = participants.slice(i, i + gridCols).map((p, j) => ({
        participant: p,
        index: i + j,
      }))
      result.push({ participants: row })
    }
    return result
  }, [participants, viewMode, gridCols])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => (viewMode === "compact" ? COMPACT_ROW_HEIGHT : GRID_ROW_HEIGHT),
    gap: GAP,
    overscan: 5,
  })

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el || rows.length === 0) return

    const maybeFetchNext = () => {
      const items = rowVirtualizer.getVirtualItems()
      const last = items.at(-1)
      if (!last) return
      if (last.index >= rows.length - 3 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    }

    maybeFetchNext()
    el.addEventListener("scroll", maybeFetchNext, { passive: true })
    return () => el.removeEventListener("scroll", maybeFetchNext)
  }, [rowVirtualizer, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (error) {
    return (
      <div className="rounded-2xl border border-border/60 bg-white px-6 py-16 text-center">
        <h2 className="font-gothic text-xl font-bold text-brand-black">
          Failed to load participants
        </h2>
        <p className="mt-2 text-sm text-brand-gray">
          {error.message || "An unknown error occurred"}
        </p>
      </div>
    )
  }

  const isInitialLoading =
    !isClientMounted || (isPendingParticipants && participants.length === 0)

  if (!isInitialLoading && participants.length === 0) {
    return (
      <div className="space-y-4">
        <ListToolbar
          participantSummary={
            totalMatchingParticipants > 0
              ? `Showing 0 of ${totalMatchingParticipants} participants`
              : "0 participants"
          }
          isRefreshingResults={isRefreshingResults}
        />
        <div className="rounded-2xl border border-border/60 bg-white px-6 py-16 text-center">
          <h2 className="font-gothic text-xl font-bold text-brand-black">
            No participants found
          </h2>
          <p className="mt-2 text-sm text-brand-gray">
            {selectedRatings.length > 0
              ? "Try adjusting the rating filters."
              : "There are no participants to review yet."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        participantSummary={isInitialLoading ? "" : participantSummary}
        isRefreshingResults={isInitialLoading ? false : isRefreshingResults}
        isPending={isInitialLoading}
      />

      <div
        ref={scrollContainerRef}
        className="max-h-[calc(100vh-220px)] overflow-auto rounded-2xl"
      >
        {isInitialLoading ? (
          <div className="grid grid-cols-1 gap-3 p-1">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-white px-3 py-2.5"
              >
                <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div
              className="relative w-full"
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index]
                if (!row) return null

                return (
                  <div
                    key={virtualRow.key}
                    className={`absolute left-0 top-0 w-full ${
                      viewMode === "grid"
                        ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                        : ""
                    }`}
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.participants.map(({ participant, index }) => {
                      const ratingData = ratingByParticipantId.get(participant.id)
                      const rating = ratingData?.rating ?? 0
                      const finalRanking =
                        (ratingData?.finalRanking as 1 | 2 | 3 | null | undefined) ?? null

                      return (
                        <JuryParticipantCard
                          key={participant.id}
                          participant={participant}
                          rating={rating}
                          finalRanking={finalRanking}
                          onClick={() =>
                            selectParticipant(participant.id, index)
                          }
                          variant={viewMode}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {isFetchingNextPage ? (
              <div className="flex justify-center py-6">
                <div className="flex items-center gap-2 text-sm text-brand-gray">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
                  Loading more...
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function ListToolbar({
  participantSummary,
  isRefreshingResults,
  isPending = false,
}: {
  participantSummary: string
  isRefreshingResults: boolean
  isPending?: boolean
}) {
  const {
    viewMode,
    setViewMode,
    selectedRatings,
    toggleRatingFilter,
    clearRatingFilter,
  } = useJuryReviewQueryState()

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        {isPending ? (
          <Skeleton className="h-4 w-48 max-w-full" />
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium text-brand-black">
            {participantSummary}
            {isRefreshingResults ? (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-brand-gray">
                <Loader2 className="h-3 w-3 animate-spin text-brand-primary" />
                Updating
              </span>
            ) : null}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selectedRatings.length > 0 ? (
          <button
            type="button"
            onClick={clearRatingFilter}
            className="inline-flex items-center rounded-full border border-border/60 bg-white px-3 py-1.5 text-xs font-medium text-brand-gray transition-colors hover:border-brand-primary/30 hover:text-brand-black"
          >
            Clear filter
          </button>
        ) : null}
        <RatingFilterBar
          selectedRatings={selectedRatings}
          onToggle={toggleRatingFilter}
          isPending={isPending || isRefreshingResults}
        />
        <div className="flex items-center rounded-xl border border-border/60 bg-white">
          <button
            type="button"
            onClick={() => void setViewMode("grid")}
            className={`rounded-l-xl px-2.5 py-2 transition-colors ${
              viewMode === "grid"
                ? "bg-neutral-100 text-brand-black"
                : "text-brand-gray hover:text-brand-black"
            }`}
            aria-label="Grid view"
          >
            <Grid2x2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void setViewMode("compact")}
            className={`rounded-r-xl px-2.5 py-2 transition-colors ${
              viewMode === "compact"
                ? "bg-neutral-100 text-brand-black"
                : "text-brand-gray hover:text-brand-black"
            }`}
            aria-label="Compact list view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
