"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { FullscreenImage } from "@/components/fullscreen-image"
import { useVotingCarouselApi } from "@/app/(marathon)/live/[domain]/vote/[token]/viewer/_hooks/use-voting-carousel-api";
import { useVotingSearchParams } from "@/app/(marathon)/live/[domain]/vote/[token]/viewer/_hooks/use-voting-search-params";
import { OwnSubmissionBadge } from "./own-submission-badge";
import type { VotingSubmission } from "@/lib/vote/voting-submission";

interface CarouselViewProps {
  submissions: VotingSubmission[];
}

const IMAGE_RENDER_WINDOW_SIZE = 1;

export function isSubmissionInRenderWindow(index: number, currentImageIndex: number) {
  return Math.abs(index - currentImageIndex) <= IMAGE_RENDER_WINDOW_SIZE;
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
            {submissions.map((submission, index) => {
              const shouldRenderImage = isSubmissionInRenderWindow(index, currentImageIndex);

              return (
                <CarouselItem
                  key={submission.submissionId}
                  className="h-full flex items-center justify-center"
                >
                  <div className="relative w-full h-full flex items-center justify-center p-2">
                    {submission.url && shouldRenderImage ? (
                      <button
                        onClick={() => setIsFullscreen(true)}
                        className="relative w-full h-full cursor-zoom-in flex items-center justify-center overflow-hidden rounded-lg"
                      >
                        {submission.isOwnSubmission && <OwnSubmissionBadge />}
                        <Image
                          src={submission.url}
                          alt={`photo-${submission.submissionId}`}
                          fill
                          sizes="100vw"
                          quality={75}
                          priority={index === currentImageIndex}
                          loading={index === currentImageIndex ? "eager" : "lazy"}
                          className="object-contain"
                        />
                      </button>
                    ) : submission.url ? (
                      <div className="h-full w-full rounded-lg bg-muted/40" aria-hidden />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full bg-muted rounded-lg">
                        <span className="text-muted-foreground">
                          Image not available
                        </span>
                      </div>
                    )}
                  </div>
                </CarouselItem>
              );
            })}
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
