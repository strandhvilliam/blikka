"use client";

import {
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  LayoutGrid,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
              <PopoverContent
                side="top"
                align="center"
                className="w-64 text-sm leading-relaxed"
              >
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
