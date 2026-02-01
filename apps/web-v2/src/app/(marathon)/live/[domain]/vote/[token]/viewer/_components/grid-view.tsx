"use client";

import * as React from "react";

interface VotingSubmission {
  submissionId: number;
  participantId: number;
  participantFirstName: string;
  participantLastName: string;
  url?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  topicId: number;
  topicName: string;
}

interface GridViewProps {
  submissions: VotingSubmission[];
  selectedSubmissionId: number | null;
  currentImageIndex: number;
  getRating: (submissionId: number) => number | undefined;
  onThumbnailClick: (index: number) => void;
}

export function GridView({
  submissions,
  selectedSubmissionId,
  currentImageIndex,
  getRating,
  onThumbnailClick,
}: GridViewProps) {
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
              onClick={() => onThumbnailClick(index)}
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
                  <div className="absolute inset-0 ring-4 ring-yellow-400 ring-inset" />
                  <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-950 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    VIEWING
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
