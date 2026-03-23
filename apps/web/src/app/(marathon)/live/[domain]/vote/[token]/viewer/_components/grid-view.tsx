"use client"

import { Eye, Images } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { useVotingSearchParams } from "../_hooks/use-voting-search-params"
import { useVotingCarouselApi } from "../_hooks/use-voting-carousel-api"
import { OwnSubmissionBadge } from "./own-submission-badge"
import type { VotingSubmission } from "../_lib/voting-submission"

interface GridViewProps {
  submissions: VotingSubmission[]
  selectedSubmissionId: number | null
  getRating: (submissionId: number) => number | undefined
  onViewModeChange?: (mode: "carousel" | "grid") => void
}

export function GridView({
  submissions,
  selectedSubmissionId,
  getRating,
  onViewModeChange,
}: GridViewProps) {
  const { currentImageIndex, setParams } = useVotingSearchParams()
  const { isNavigatingRef } = useVotingCarouselApi()
  const t = useTranslations("VotingViewerPage")

  const handleThumbnailClick = (index: number) => {
    isNavigatingRef.current = true
    setParams({ image: index, view: "carousel" })
    setTimeout(() => {
      isNavigatingRef.current = false
    }, 100)
  }

  return (
    <div className="relative h-full overflow-y-auto p-4 pb-20">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {submissions.map((submission, index) => {
          const rating = getRating(submission.submissionId)
          const isSelected = submission.submissionId === selectedSubmissionId
          const isActive = index === currentImageIndex
          return (
            <button
              key={submission.submissionId}
              onClick={() => handleThumbnailClick(index)}
              className="relative aspect-square overflow-hidden rounded-xl bg-muted"
            >
              {submission.thumbnailUrl || submission.url ? (
                <img
                  src={submission.thumbnailUrl || submission.url}
                  alt={t("gridView.photoAlt", {
                    participantId: submission.participantId,
                  })}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <span className="text-xs text-muted-foreground">{t("gridView.noImage")}</span>
                </div>
              )}
              {submission.isOwnSubmission && <OwnSubmissionBadge compact />}
              {rating !== undefined && (
                <div className="absolute top-1 right-1 rounded-full bg-background/80 px-1.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                  ★{rating}
                </div>
              )}
              {isActive && (
                <>
                  <div className="absolute inset-0 rounded-xl ring-2 ring-foreground ring-inset" />
                  <div
                    className={cn(
                      "absolute left-1.5 flex items-center gap-1 rounded-full bg-foreground py-0.5 pl-1.5 pr-2 shadow-md",
                      submission.isOwnSubmission ? "top-8" : "top-1.5",
                    )}
                  >
                    <Eye className="h-3 w-3 text-background" />
                    <span className="text-[10px] font-semibold text-background">
                      {t("gridView.viewing")}
                    </span>
                  </div>
                </>
              )}
              {isSelected && (
                <div className="absolute inset-0 ring-2 ring-foreground ring-inset" />
              )}
            </button>
          )
        })}
      </div>

      {onViewModeChange && (
        <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center">
          <button
            onClick={() => onViewModeChange("carousel")}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-foreground shadow-lg transition-colors hover:bg-foreground/90"
            aria-label={t("gridView.showCarousel")}
          >
            <Images className="h-6 w-6 text-background" />
          </button>
        </div>
      )}
    </div>
  )
}
