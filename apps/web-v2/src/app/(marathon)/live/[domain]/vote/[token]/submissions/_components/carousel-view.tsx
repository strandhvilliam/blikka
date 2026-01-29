"use client";

import * as React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

interface ImageData {
  id: string;
  url: string;
}

interface CarouselViewProps {
  images: ImageData[];
  currentFilter: number | null;
  onApiChange: (api: CarouselApi) => void;
}

export function CarouselView({
  images,
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
          {images.map((image) => (
            <CarouselItem
              key={image.id}
              className="h-full flex items-center justify-center"
            >
              <img
                src={image.url}
                alt="Photo to review"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
