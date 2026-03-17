"use client";

import { useState, useCallback } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { FullscreenImage } from "./fullscreen-image";
import { useVotingCarouselApi } from "../_hooks/use-voting-carousel-api";
import { useVotingSearchParams } from "../_hooks/use-voting-search-params";
import { OwnSubmissionBadge } from "./own-submission-badge";
import type { VotingSubmission } from "../_lib/voting-submission";

interface CarouselViewProps {
  submissions: VotingSubmission[];
}

export function CarouselView({ submissions }: CarouselViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { setApi } = useVotingCarouselApi();
  const { currentFilter, currentImageIndex } = useVotingSearchParams();

  const handleApiChange = useCallback(
    (newApi: CarouselApi) => {
      setApi(newApi);
    },
    [setApi],
  );

  const currentSubmission = submissions[currentImageIndex];

  return (
    <>
      <div className="h-full px-2 sm:px-4 py-2">
        <Carousel
          key={currentFilter ?? "all"}
          setApi={handleApiChange}
          opts={{
            align: "center",
            loop: false,
          }}
          className="w-full h-full"
        >
          <CarouselContent className="h-full">
            {submissions.map((submission) => (
              <CarouselItem
                key={submission.submissionId}
                className="h-full flex items-center justify-center"
              >
                <div className="relative w-full h-full flex items-center justify-center p-2">
                  {submission.url ? (
                    <button
                      onClick={() => setIsFullscreen(true)}
                      className="relative w-full h-full cursor-zoom-in flex items-center justify-center overflow-hidden rounded-lg"
                    >
                      {submission.isOwnSubmission && <OwnSubmissionBadge />}
                      <img
                        src={submission.url}
                        alt={`photo-${submission.submissionId}`}
                        className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
                      />
                    </button>
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-muted rounded-lg">
                      <span className="text-muted-foreground">
                        Image not available
                      </span>
                    </div>
                  )}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {currentSubmission && (
        <FullscreenImage
          src={currentSubmission.url || ""}
          alt={`photo-${currentSubmission.submissionId}`}
          isOpen={isFullscreen}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </>
  );
}
