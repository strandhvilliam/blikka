"use client"

import { ActiveRatingFilterBadge } from "./rating-filter"
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react"

type JurySubmissionCompactNavProps = {
  onBack: () => void
  selectedRatings: number[]
  canOpenFullscreen: boolean
  onOpenFullscreen: () => void
  currentParticipantIndex: number
  loadedParticipantCount: number
  visibleTotal: number
  onGoToPrev: () => void
  onGoToNext: () => void
}

export function JurySubmissionCompactNav({
  onBack,
  selectedRatings,
  canOpenFullscreen,
  onOpenFullscreen,
  currentParticipantIndex,
  loadedParticipantCount,
  visibleTotal,
  onGoToPrev,
  onGoToNext,
}: JurySubmissionCompactNavProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-brand-black transition-colors hover:bg-neutral-100"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
        <ActiveRatingFilterBadge selectedRatings={selectedRatings} />
      </div>

      <div className="flex items-center gap-2">
        {canOpenFullscreen ? (
          <button
            type="button"
            className="hidden h-8 w-8 items-center justify-center rounded-full border border-border/60 text-brand-black transition-colors hover:bg-neutral-50 md:flex"
            onClick={onOpenFullscreen}
            title="Fullscreen"
            aria-label="View image fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-brand-black transition-colors hover:bg-neutral-50 disabled:opacity-30"
          disabled={currentParticipantIndex === 0}
          onClick={onGoToPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-gothic text-sm font-bold tabular-nums text-brand-black">
          {currentParticipantIndex + 1}
          <span className="font-sans font-normal text-brand-gray">
            {" / "}
            {visibleTotal}
          </span>
        </span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-brand-black transition-colors hover:bg-neutral-50 disabled:opacity-30"
          disabled={currentParticipantIndex >= loadedParticipantCount - 1}
          onClick={onGoToNext}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
