"use client";

import * as React from "react";

interface ImageData {
  id: string;
  url: string;
}

interface GridViewProps {
  images: ImageData[];
  selectedImageId: string | null;
  currentImageIndex: number;
  getRating: (imageId: string) => number | undefined;
  onThumbnailClick: (index: number) => void;
}

export function GridView({
  images,
  selectedImageId,
  currentImageIndex,
  getRating,
  onThumbnailClick,
}: GridViewProps) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {images.map((image, index) => {
          const rating = getRating(image.id);
          const isSelected = image.id === selectedImageId;
          const isActive = index === currentImageIndex;
          return (
            <button
              key={image.id}
              onClick={() => onThumbnailClick(index)}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted"
            >
              <img
                src={image.url}
                alt="Thumbnail"
                className="w-full h-full object-cover"
              />
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
