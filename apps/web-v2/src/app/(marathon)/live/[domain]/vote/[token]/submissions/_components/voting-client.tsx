"use client";

import * as React from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { type CarouselApi } from "@/components/ui/carousel";
import { FilterBar } from "./filter-bar";
import { EmptyState } from "./empty-state";
import { CarouselView } from "./carousel-view";
import { GridView } from "./grid-view";
import { VotingFooter } from "./voting-footer";
import { useVotingState } from "../_hooks/use-voting-state";
import { useVotingSearchParams } from "../_hooks/use-voting-search-params";

// Placeholder image data
const placeholderImages = Array.from({ length: 50 }, (_, i) => ({
  id: `image-${i + 1}`,
  url: `https://picsum.photos/800/600?random=${i + 1}`,
}));

interface VotingClientProps {
  domain: string;
}

export function VotingClient({ domain }: VotingClientProps) {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [api, setApi] = React.useState<CarouselApi>();
  const isNavigatingRef = React.useRef(false);
  const hasInitializedRef = React.useRef(false);

  // Search param state for current image index and view mode
  const {
    currentImageIndex,
    viewMode,
    setCurrentImageIndex,
    setViewMode,
    setParams,
  } = useVotingSearchParams();

  // Get marathon data (placeholder for now)
  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  );

  // State management
  const [currentFilter, setCurrentFilter] = React.useState<number | null>(null);

  const {
    ratings,
    selectedImageId,
    setRating,
    setSelectedImage,
    getRating,
    getFilteredImages,
    stats,
  } = useVotingState({
    images: placeholderImages,
    storageKey: `voting-${domain}-${token || "anon"}`,
  });

  // Filtered images
  const filteredImages = React.useMemo(
    () => getFilteredImages(currentFilter),
    [currentFilter, getFilteredImages],
  );

  // Handle filter change - reset to first image
  const handleFilterChange = (filter: number | null) => {
    setCurrentFilter(filter);
    setCurrentImageIndex(0);
  };

  // Track carousel index changes and sync with URL params
  const prevApiRef = React.useRef<CarouselApi>(undefined);
  React.useEffect(() => {
    if (!api) return;

    // Reset initialization flag only when api changes (carousel remounts)
    if (api !== prevApiRef.current) {
      hasInitializedRef.current = false;
      prevApiRef.current = api;
    }

    const onSelect = () => {
      // Skip the first select event (initial mount)
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        return;
      }

      // Skip if we're programmatically navigating
      if (isNavigatingRef.current) return;

      const index = api.selectedScrollSnap();
      if (index !== currentImageIndex) {
        console.log("onSelect", index);
        setCurrentImageIndex(index);
      }
    };

    api.on("select", onSelect);

    return () => {
      api.off("select", onSelect);
    };
  }, [api, currentImageIndex, setCurrentImageIndex]);

  // Sync carousel with URL param changes
  React.useEffect(() => {
    if (api) {
      isNavigatingRef.current = true;
      api.scrollTo(currentImageIndex);
      // Reset flag after scroll animation
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 100);
    }
  }, [api, currentImageIndex]);

  const currentImage = filteredImages[currentImageIndex];
  const currentRating = currentImage ? getRating(currentImage.id) : undefined;
  const isSelected = currentImage?.id === selectedImageId;

  const handleRatingChange = (rating: number) => {
    if (!currentImage) return;
    setRating(currentImage.id, rating);
    toast.success(`Rated ${rating} stars`, { duration: 1000 });
  };

  const handleVote = () => {
    if (!currentImage) return;
    setSelectedImage(currentImage.id);
    toast.success("Selected as your vote!");
  };

  const handleComplete = () => {
    if (!selectedImageId) {
      toast.error("Please select an image to vote for first");
      return;
    }
    // TODO: Submit vote to server
    toast.success("Voting completed! Thank you.");
  };

  const handleThumbnailClick = (index: number) => {
    isNavigatingRef.current = true;
    setParams({ image: index, view: "carousel" });
    // Reset flag after params update
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 100);
  };

  const hasImages = filteredImages.length > 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with progress and filter */}
      <FilterBar
        currentFilter={currentFilter}
        onFilterChange={handleFilterChange}
        ratingCounts={stats.ratingCounts}
        currentIndex={currentImageIndex}
        totalCount={filteredImages.length}
      />

      {/* Image viewer - carousel or grid */}
      <div className="flex-1 overflow-hidden">
        {!hasImages ? (
          <EmptyState
            currentFilter={currentFilter}
            onClearFilter={() => setCurrentFilter(null)}
          />
        ) : viewMode === "carousel" ? (
          <CarouselView
            images={filteredImages}
            currentFilter={currentFilter}
            onApiChange={setApi}
          />
        ) : (
          <GridView
            images={filteredImages}
            selectedImageId={selectedImageId}
            currentImageIndex={currentImageIndex}
            getRating={getRating}
            onThumbnailClick={handleThumbnailClick}
          />
        )}
      </div>

      {/* Bottom controls / Footer */}
      <VotingFooter
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentRating={currentRating}
        onRatingChange={handleRatingChange}
        isSelected={isSelected}
        hasImages={hasImages}
        onVote={handleVote}
        onComplete={handleComplete}
        showComplete={stats.hasCompletedReview && stats.hasSelectedFinal}
        api={api}
        currentIndex={currentImageIndex}
        totalCount={filteredImages.length}
        stats={{
          hasCompletedReview: stats.hasCompletedReview,
          hasSelectedFinal: stats.hasSelectedFinal,
          rated: stats.rated,
          total: filteredImages.length,
        }}
        completionMessage={
          !stats.hasSelectedFinal && stats.hasCompletedReview
            ? "You've rated all images! Select your final vote above."
            : undefined
        }
      />
    </div>
  );
}
