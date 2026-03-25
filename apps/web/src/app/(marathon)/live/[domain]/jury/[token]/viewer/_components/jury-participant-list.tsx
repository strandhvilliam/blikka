"use client"

import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import type { JuryRatingsResponse } from "../../_lib/jury-types"
import type { JuryListParticipant } from "../_lib/jury-list-participant"
import { JuryParticipantCard } from "./jury-participant-card"
import { RatingFilterBar } from "./rating-filter"

export function JuryParticipantList({
  participants,
  ratingByParticipantId,
  selectedRatings,
  toggleRatingFilter,
  clearRatingFilter,
  onParticipantSelect,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isRefreshingResults,
  totalParticipants,
  error,
}: {
  participants: JuryListParticipant[]
  ratingByParticipantId: Map<number, JuryRatingsResponse["ratings"][number]>
  selectedRatings: number[]
  toggleRatingFilter: (rating: number) => void
  clearRatingFilter: () => void
  onParticipantSelect: (participantId: number, index: number) => void
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isRefreshingResults: boolean
  totalParticipants?: { value: number }
  error: Error | null
}) {
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const totalMatchingParticipants = totalParticipants?.value ?? participants.length
  const participantSummary =
    participants.length < totalMatchingParticipants
      ? `Showing ${participants.length} of ${totalMatchingParticipants} participants`
      : `${totalMatchingParticipants} participants`

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )

    const target = loadMoreRef.current
    if (target) {
      observer.observe(target)
    }

    return () => {
      if (target) {
        observer.unobserve(target)
      }
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  if (error) {
    return (
      <div className="rounded-xl border border-border/60 bg-white px-6 py-16 text-center">
        <h2 className="font-rocgrotesk text-xl font-bold text-brand-black">
          Failed to load participants
        </h2>
        <p className="mt-2 text-sm text-brand-gray">
          {error.message || "An unknown error occurred"}
        </p>
      </div>
    )
  }

  if (participants.length === 0) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-brand-black">
              {totalMatchingParticipants > 0
                ? `Showing 0 of ${totalMatchingParticipants} participants`
                : "0 participants"}
              {isRefreshingResults ? (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-brand-gray">
                  <Loader2 className="h-3 w-3 animate-spin text-brand-primary" />
                  Updating
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
              isPending={isRefreshingResults}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-white px-6 py-16 text-center">
          <h2 className="font-rocgrotesk text-xl font-bold text-brand-black">
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
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-brand-black">
            {participantSummary}
            {isRefreshingResults ? (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-brand-gray">
                <Loader2 className="h-3 w-3 animate-spin text-brand-primary" />
                Updating
              </span>
            ) : null}
          </p>
        </div>
        <RatingFilterBar
          selectedRatings={selectedRatings}
          onToggle={toggleRatingFilter}
          isPending={isRefreshingResults}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {participants.map((participant, index) => {
          const rating = ratingByParticipantId.get(participant.id)?.rating ?? 0

          return (
            <JuryParticipantCard
              key={participant.id}
              participant={participant}
              rating={rating}
              onClick={() => onParticipantSelect(participant.id, index)}
            />
          )
        })}
      </div>

      {hasNextPage ? (
        <div ref={loadMoreRef} className="flex justify-center py-10">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-sm text-brand-gray">
              <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
              Loading more...
            </div>
          ) : (
            <div className="h-8" />
          )}
        </div>
      ) : null}
    </div>
  )
}
