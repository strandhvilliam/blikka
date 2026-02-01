"use client";

import * as React from "react";
import { LayoutGrid, Info } from "lucide-react";
import { type CarouselApi } from "@/components/ui/carousel";
import { StarRating } from "./star-rating";
import { VoteButton } from "./vote-button";
import { VotingInfoDrawer } from "./voting-info-drawer";
import { NavigationControls } from "./navigation-controls";

interface VotingStats {
  hasCompletedReview: boolean;
  hasSelectedFinal: boolean;
  rated: number;
  total: number;
}

interface VotingFooterProps {
  viewMode: "carousel" | "grid";
  onViewModeChange: (mode: "carousel" | "grid") => void;
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
  stats: VotingStats;
  completionMessage?: string;
}

export function VotingFooter({
  viewMode,
  onViewModeChange,
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
  stats,
  completionMessage,
}: VotingFooterProps) {
  return (
    <div className="flex-none p-4 space-y-4 bg-background border-t">
      {viewMode === "carousel" && hasImages && (
        <>
          <NavigationControls
            api={api}
            currentIndex={currentIndex}
            totalCount={totalCount}
          />
          <StarRating value={currentRating} onChange={onRatingChange} />
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            onViewModeChange(viewMode === "carousel" ? "grid" : "carousel")
          }
          className="h-14 w-14 flex-none rounded-2xl bg-muted border-0 shadow-sm hover:bg-muted/80 active:scale-[0.98] flex items-center justify-center transition-all"
          aria-label={
            viewMode === "carousel" ? "Show grid view" : "Show carousel view"
          }
        >
          <LayoutGrid className="w-6 h-6" />
        </button>

        <VoteButton
          isSelected={isSelected}
          isEnabled={hasImages}
          onVote={onVote}
          onComplete={onComplete}
          showComplete={showComplete}
          className="flex-1"
        />

        <VotingInfoDrawer
          votingInfo={{ rated: stats.rated, total: stats.total }}
        >
          <button
            className="h-14 w-14 flex-none rounded-2xl bg-muted border-0 shadow-sm hover:bg-muted/80 active:scale-[0.98] flex items-center justify-center transition-all"
            aria-label="How voting works"
          >
            <Info className="w-6 h-6" />
          </button>
        </VotingInfoDrawer>
      </div>

      {completionMessage && (
        <p className="text-center text-sm text-muted-foreground">
          {completionMessage}
        </p>
      )}
    </div>
  );
}
