"use client";

import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useCarouselGestures } from "../_hooks/use-carousel-gestures";

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

interface CarouselViewProps {
  submissions: VotingSubmission[];
  currentFilter: number | null;
  onApiChange: (api: CarouselApi) => void;
}

export function CarouselView({
  submissions,
  currentFilter,
  onApiChange,
}: CarouselViewProps) {
  const [api, setApi] = React.useState<CarouselApi>();

  // Handle API setup
  const handleApiChange = React.useCallback(
    (newApi: CarouselApi) => {
      setApi(newApi);
      onApiChange(newApi);
    },
    [onApiChange],
  );

  // Add swipe gesture support
  const { bind } = useCarouselGestures({
    onSwipeLeft: () => api?.scrollNext(),
    onSwipeRight: () => api?.scrollPrev(),
  });

  return (
    <div className="h-full px-4 py-2" {...bind()}>
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
              <div className="relative w-full h-full flex items-center justify-center">
                {submission.url ? (
                  <img
                    src={submission.url}
                    alt={`Photo by ${submission.participantFirstName} ${submission.participantLastName}`}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
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
  );
}
