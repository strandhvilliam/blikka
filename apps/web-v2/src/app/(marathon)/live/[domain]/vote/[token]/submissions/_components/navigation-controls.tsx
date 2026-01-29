"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type CarouselApi } from "@/components/ui/carousel";

interface NavigationControlsProps {
  api: CarouselApi | undefined;
  currentIndex: number;
  totalCount: number;
}

export function NavigationControls({
  api,
  currentIndex,
  totalCount,
}: NavigationControlsProps) {
  return (
    <div className="flex items-center justify-center gap-8">
      <button
        onClick={() => api?.scrollPrev()}
        disabled={currentIndex === 0}
        className="h-12 w-12 rounded-full bg-muted/50 border-0 shadow-sm hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        aria-label="Previous image"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={() => api?.scrollNext()}
        disabled={currentIndex >= totalCount - 1}
        className="h-12 w-12 rounded-full bg-muted/50 border-0 shadow-sm hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        aria-label="Next image"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
}
