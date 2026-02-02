"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type CarouselApi } from "@/components/ui/carousel";
import { StarRating } from "./star-rating";
import { VoteButton } from "./vote-button";

interface VotingFooterProps {
  viewMode: "carousel" | "grid";
  currentRating: number | undefined;
  onRatingChange: (rating: number) => void;
  isSelected: boolean;
  hasImages: boolean;
  onVote: () => void;
  onComplete: () => void;
  showComplete: boolean;
  api: CarouselApi | undefined;
  currentIndex: number;
  totalCount: number;
  completionMessage?: string;
}

export function VotingFooter({
  viewMode,
  currentRating,
  onRatingChange,
  isSelected,
  hasImages,
  onVote,
  onComplete,
  showComplete,
  api,
  currentIndex,
  totalCount,
  completionMessage,
}: VotingFooterProps) {
  return (
    <div className="flex-none bg-background border-t">
      {/* Navigation and Rating - only show in carousel mode */}
      {viewMode === "carousel" && hasImages && (
        <div className="px-4 pt-4 pb-2 space-y-4">
          {/* Navigation hint - subtle instruction */}
          <p className="text-center text-xs text-muted-foreground/60">
            Swipe or tap arrows to navigate
          </p>

          {/* Navigation arrows - centered below image */}
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={() => api?.scrollPrev()}
              disabled={currentIndex === 0}
              className="h-12 w-12 rounded-full bg-muted border-0 shadow-sm hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => api?.scrollNext()}
              disabled={currentIndex >= totalCount - 1}
              className="h-12 w-12 rounded-full bg-muted border-0 shadow-sm hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Star rating - centered below navigation */}
          <StarRating value={currentRating} onChange={onRatingChange} />
        </div>
      )}

      {/* Vote button - always at bottom */}
      <div className="p-4">
        <VoteButton
          isSelected={isSelected}
          isEnabled={hasImages}
          onVote={onVote}
          onComplete={onComplete}
          showComplete={showComplete}
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
