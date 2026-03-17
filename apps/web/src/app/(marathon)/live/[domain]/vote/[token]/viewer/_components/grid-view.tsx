"use client";

import { Eye, Images } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useVotingSearchParams } from "../_hooks/use-voting-search-params";
import { useVotingCarouselApi } from "../_hooks/use-voting-carousel-api";
import { OwnSubmissionBadge } from "./own-submission-badge";
import type { VotingSubmission } from "../_lib/voting-submission";

interface GridViewProps {
  submissions: VotingSubmission[];
  selectedSubmissionId: number | null;
  getRating: (submissionId: number) => number | undefined;
  onViewModeChange?: (mode: "carousel" | "grid") => void;
}

export function GridView({
  submissions,
  selectedSubmissionId,
  getRating,
  onViewModeChange,
}: GridViewProps) {
  const { currentImageIndex, setParams } = useVotingSearchParams();
  const { isNavigatingRef } = useVotingCarouselApi();
  const t = useTranslations("VotingViewerPage");

  const handleThumbnailClick = (index: number) => {
    isNavigatingRef.current = true;
    setParams({ image: index, view: "carousel" });
    // Reset flag after params update
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 100);
  };

  return (
    <div className="h-full overflow-y-auto p-4 relative pb-20">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {submissions.map((submission, index) => {
          const rating = getRating(submission.submissionId);
          const isSelected = submission.submissionId === selectedSubmissionId;
          const isActive = index === currentImageIndex;
          return (
            <button
              key={submission.submissionId}
              onClick={() => handleThumbnailClick(index)}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted"
            >
              {submission.thumbnailUrl || submission.url ? (
                <img
                  src={submission.thumbnailUrl || submission.url}
                  alt={t("gridView.photoAlt", {
                    participantId: submission.participantId,
                  })}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-muted">
                  <span className="text-muted-foreground text-xs">
                    {t("gridView.noImage")}
                  </span>
                </div>
              )}
              {submission.isOwnSubmission && <OwnSubmissionBadge compact />}
              {rating !== undefined && (
                <div className="absolute top-1 right-1 bg-background/80 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-xs font-medium">
                  ★{rating}
                </div>
              )}
              {isActive && (
                <>
                  <div className="absolute inset-0 ring-2 ring-[#FF5D4B] ring-inset rounded-lg" />
                  <div
                    className={cn(
                      "absolute left-1.5 flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 shadow-md",
                      submission.isOwnSubmission ? "top-8" : "top-1.5",
                    )}
                    style={{ backgroundColor: "#FF5D4B" }}
                  >
                    <Eye className="w-3 h-3 text-white" />
                    <span className="text-[10px] font-semibold text-white">
                      {t("gridView.viewing")}
                    </span>
                  </div>
                </>
              )}
              {isSelected && (
                <div className="absolute inset-0 ring-2 ring-primary ring-inset" />
              )}
            </button>
          );
        })}
      </div>

      {onViewModeChange && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
          <button
            onClick={() => onViewModeChange("carousel")}
            className="pointer-events-auto h-12 w-12 rounded-full bg-muted border-0 shadow-lg hover:bg-muted/80 flex items-center justify-center transition-colors"
            aria-label={t("gridView.showCarousel")}
          >
            <Images className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
