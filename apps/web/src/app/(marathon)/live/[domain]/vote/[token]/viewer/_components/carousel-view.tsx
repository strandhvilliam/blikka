"use client";

import { useState, useEffect, useCallback } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { FullscreenImage } from "./fullscreen-image";
import { useVotingCarouselApi } from "../_hooks/use-voting-carousel-api";
import { useVotingSearchParams } from "../_hooks/use-voting-search-params";

interface VotingSubmission {
  submissionId: number;
  participantId: number;
  url?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  topicId: number;
  topicName: string;
}

interface CarouselViewProps {
  submissions: VotingSubmission[];
}

export function CarouselView({
  submissions,
}: CarouselViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { api, setApi } = useVotingCarouselApi();
  const { currentFilter } = useVotingSearchParams();

  const handleApiChange = useCallback(
    (newApi: CarouselApi) => {
      setApi(newApi);
    },
    [setApi],
  );

  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrentIndex(api.selectedScrollSnap());
    };

    api.on("select", onSelect);

    setCurrentIndex(api.selectedScrollSnap());

    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const currentSubmission = submissions[currentIndex];

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
                      className="w-full h-full cursor-zoom-in flex items-center justify-center"
                    >
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
