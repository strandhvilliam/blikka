"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { useVotingSearchParams } from "../_hooks/use-voting-search-params";
import { useVotingCarouselApi } from "../_hooks/use-voting-carousel-api";

interface VotingSubmission {
  submissionId: number;
  participantId: number;
  url?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  topicId: number;
  topicName: string;
}

interface GridViewProps {
  submissions: VotingSubmission[];
  selectedSubmissionId: number | null;
  getRating: (submissionId: number) => number | undefined;
}

export function GridView({
  submissions,
  selectedSubmissionId,
  getRating,
}: GridViewProps) {

  const { currentImageIndex, setParams } = useVotingSearchParams();
  const { isNavigatingRef } = useVotingCarouselApi();

  const handleThumbnailClick = (index: number) => {
    isNavigatingRef.current = true;
    setParams({ image: index, view: "carousel" });
    // Reset flag after params update
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 100);
  };

  return (
    <div className="h-full overflow-y-auto p-4">
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
                  alt={`Photo by ${submission.participantFirstName} ${submission.participantLastName}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-muted">
                  <span className="text-muted-foreground text-xs">
                    No image
                  </span>
                </div>
              )}
              {/* Rating indicator */}
              {rating !== undefined && (
                <div className="absolute top-1 right-1 bg-background/80 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-xs font-medium">
                  ★{rating}
                </div>
              )}
              {/* Active indicator - current image being viewed */}
              {isActive && (
                <>
                  <div className="absolute inset-0 ring-2 ring-[#FF5D4B] ring-inset rounded-lg" />
                  <div
                    className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 shadow-md"
                    style={{ backgroundColor: "#FF5D4B" }}
                  >
                    <Eye className="w-3 h-3 text-white" />
                    <span className="text-[10px] font-semibold text-white">
                      Viewing
                    </span>
                  </div>
                </>
              )}
              {/* Selected indicator - voted image */}
              {isSelected && (
                <div className="absolute inset-0 ring-2 ring-primary ring-inset" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
