"use client";

import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

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
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-2">
      <Carousel
        key={currentFilter ?? "all"}
        setApi={onApiChange}
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
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
