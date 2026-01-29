"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface ImageData {
  id: string;
  url: string;
}

interface VotingState {
  ratings: Record<string, number | undefined>;
  selectedImageId: string | null;
}

interface UseVotingStateOptions {
  images: ImageData[];
  storageKey: string;
}

export function useVotingState({ images, storageKey }: UseVotingStateOptions) {
  const [state, setState] = useState<VotingState>(() => {
    if (typeof window === "undefined") {
      return { ratings: {}, selectedImageId: null };
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as VotingState;
        // Validate that ratings only include images that exist
        const validRatings: Record<string, number> = {};
        const imageIds = new Set(images.map((img) => img.id));
        for (const [key, value] of Object.entries(parsed.ratings)) {
          if (imageIds.has(key) && value !== undefined && value !== null) {
            validRatings[key] = value;
          }
        }
        return {
          ratings: validRatings,
          selectedImageId:
            parsed.selectedImageId && imageIds.has(parsed.selectedImageId)
              ? parsed.selectedImageId
              : null,
        };
      }
    } catch (e) {
      console.error("Failed to load voting state from localStorage", e);
    }
    return { ratings: {}, selectedImageId: null };
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save voting state to localStorage", e);
    }
  }, [state, storageKey]);

  const setRating = useCallback(
    (imageId: string, rating: number | undefined) => {
      setState((prev) => ({
        ...prev,
        ratings: {
          ...prev.ratings,
          [imageId]: rating,
        },
      }));
    },
    [],
  );

  const setSelectedImage = useCallback((imageId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedImageId: imageId,
    }));
  }, []);

  const getRating = useCallback(
    (imageId: string) => state.ratings[imageId],
    [state.ratings],
  );

  // Filter images by rating
  const getFilteredImages = useCallback(
    (filterRating: number | null) => {
      if (filterRating === null) return images;
      return images.filter((img) => state.ratings[img.id] === filterRating);
    },
    [images, state.ratings],
  );

  // Statistics
  const stats = useMemo(() => {
    const total = images.length;
    const rated = Object.keys(state.ratings).filter(
      (id) => state.ratings[id] !== undefined,
    ).length;
    const unrated = total - rated;
    const hasCompletedReview = rated === total && total > 0;
    const hasSelectedFinal = state.selectedImageId !== null;

    // Count by rating
    const ratingCounts: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const rating of Object.values(state.ratings)) {
      if (rating !== undefined && rating >= 1 && rating <= 5) {
        ratingCounts[rating]++;
      }
    }

    return {
      total,
      rated,
      unrated,
      hasCompletedReview,
      hasSelectedFinal,
      ratingCounts,
    };
  }, [images, state.ratings, state.selectedImageId]);

  return {
    ratings: state.ratings,
    selectedImageId: state.selectedImageId,
    setRating,
    setSelectedImage,
    getRating,
    getFilteredImages,
    stats,
  };
}
