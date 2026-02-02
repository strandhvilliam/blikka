"use client";

import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { FullscreenImage } from "./fullscreen-image";

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
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  // Handle API setup
  const handleApiChange = React.useCallback(
    (newApi: CarouselApi) => {
      setApi(newApi);
      onApiChange(newApi);
    },
    [onApiChange],
  );

  // Track current slide index
  React.useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrentIndex(api.selectedScrollSnap());
    };

    api.on("select", onSelect);
    // Set initial index
    setCurrentIndex(api.selectedScrollSnap());

    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // Get current submission for fullscreen
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
                        alt={`Photo by ${submission.participantFirstName} ${submission.participantLastName}`}
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

      {/* Fullscreen Image Viewer */}
      {currentSubmission && (
        <FullscreenImage
          src={currentSubmission.url || ""}
          alt={`Photo by ${currentSubmission.participantFirstName} ${currentSubmission.participantLastName}`}
          isOpen={isFullscreen}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </>
  );
}
