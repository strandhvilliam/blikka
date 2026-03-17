"use client";

import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { StarRating } from "./star-rating";
import { VoteButton } from "./vote-button";
import { useVotingSearchParams } from "../_hooks/use-voting-search-params";
import { useVotingCarouselApi } from "../_hooks/use-voting-carousel-api";

interface VotingFooterProps {
  currentRating: number | undefined;
  onRatingChange: (rating: number) => void;
  isOwnSubmission: boolean;
  isSelected: boolean;
  hasVoted: boolean;
  hasImages: boolean;
  onVote: () => void;
  totalCount: number;
  completionMessage?: string;
  submissionTitle?: string;
  submissionImageUrl?: string;
  onViewModeChange?: (mode: "carousel" | "grid") => void;
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
  const { viewMode, currentImageIndex } = useVotingSearchParams();
  const { api } = useVotingCarouselApi();
  const t = useTranslations("VotingViewerPage");

  return (
    <div className="flex-none bg-background border-t">
      {/* Navigation and Rating - only show in carousel mode */}
      {viewMode === "carousel" && hasImages && (
        <div className="px-4 pt-4 pb-2 space-y-4">
          <p className="text-center text-xs text-muted-foreground/60">
            {t("footer.navigationHint")}
          </p>
          <StarRating
            value={currentRating}
            onChange={onRatingChange}
            disabled={isOwnSubmission}
          />

          <div className="flex items-center justify-center gap-8">
            <button
              onClick={() => api?.scrollPrev()}
              disabled={currentImageIndex === 0}
              className="h-12 w-12 rounded-full bg-muted border-0 shadow-sm hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              aria-label={t("footer.previousPhoto")}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => onViewModeChange?.("grid")}
              className="h-12 w-12 rounded-full bg-muted border-0 shadow-sm hover:bg-muted/80 flex items-center justify-center transition-colors"
              aria-label={t("footer.showGrid")}
            >
              <LayoutGrid className="w-6 h-6" />
            </button>
            <button
              onClick={() => api?.scrollNext()}
              disabled={currentImageIndex >= totalCount - 1}
              className="h-12 w-12 rounded-full bg-muted border-0 shadow-sm hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              aria-label={t("footer.nextPhoto")}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Vote button - always at bottom */}
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
          <p className="text-center text-sm text-muted-foreground mt-3">
            {completionMessage}
          </p>
        )}
      </div>
    </div>
  );
}
