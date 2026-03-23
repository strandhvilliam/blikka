"use client"

import {
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  LayoutGrid,
} from "lucide-react"
import { useTranslations } from "next-intl"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { StarRating } from "./star-rating"
import { VoteButton } from "./vote-button"
import { useVotingSearchParams } from "../_hooks/use-voting-search-params"
import { useVotingCarouselApi } from "../_hooks/use-voting-carousel-api"

interface VotingFooterProps {
  currentRating: number | undefined
  onRatingChange: (rating: number) => void
  isOwnSubmission: boolean
  isSelected: boolean
  hasVoted: boolean
  hasImages: boolean
  onVote: () => void
  totalCount: number
  completionMessage?: string
  submissionTitle?: string
  submissionImageUrl?: string
  onViewModeChange?: (mode: "carousel" | "grid") => void
}

export function VotingFooter({
  currentRating,
  onRatingChange,
  isOwnSubmission,
  isSelected,
  hasVoted,
  hasImages,
  onVote,
  totalCount,
  completionMessage,
  submissionTitle,
  submissionImageUrl,
  onViewModeChange,
}: VotingFooterProps) {
  const { viewMode, currentImageIndex } = useVotingSearchParams()
  const { api } = useVotingCarouselApi()
  const t = useTranslations("VotingViewerPage")

  return (
    <div className="flex-none border-t border-border bg-background">
      {viewMode === "carousel" && hasImages && (
        <div className="space-y-4 px-4 pb-2 pt-4">
          <div className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground/60">
            <p>{t("footer.navigationHint")}</p>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={t("footer.reviewHintButton")}
                >
                  <CircleQuestionMark className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="center" className="w-64 text-sm leading-relaxed">
                {t("footer.reviewHint")}
              </PopoverContent>
            </Popover>
          </div>

          <StarRating
            value={currentRating}
            onChange={onRatingChange}
            disabled={isOwnSubmission}
          />

          <div className="flex items-center justify-center gap-8">
            <button
              onClick={() => api?.scrollPrev()}
              disabled={currentImageIndex === 0}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shadow-sm transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t("footer.previousPhoto")}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => onViewModeChange?.("grid")}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shadow-sm transition-colors hover:bg-muted/80"
              aria-label={t("footer.showGrid")}
            >
              <LayoutGrid className="h-6 w-6" />
            </button>
            <button
              onClick={() => api?.scrollNext()}
              disabled={currentImageIndex >= totalCount - 1}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shadow-sm transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t("footer.nextPhoto")}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        <VoteButton
          isSelected={isSelected}
          hasVoted={hasVoted}
          isOwnSubmission={isOwnSubmission}
          isEnabled={hasImages}
          onVote={onVote}
          submissionTitle={submissionTitle}
          imageUrl={submissionImageUrl}
          className="w-full"
        />

        {completionMessage && (
          <p className="mt-3 text-center text-sm text-muted-foreground">{completionMessage}</p>
        )}
      </div>
    </div>
  )
}
