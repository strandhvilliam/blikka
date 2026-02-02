"use client";

import * as React from "react";

interface UseCarouselGesturesOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
}

export function useCarouselGestures({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: UseCarouselGesturesOptions) {
  const touchStartX = React.useRef<number | null>(null);
  const touchEndX = React.useRef<number | null>(null);

  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchMove = React.useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchEnd = React.useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null) return;

    const distance = touchStartX.current - touchEndX.current;

    if (Math.abs(distance) > threshold) {
      if (distance > 0) {
        // Swiped left - go next
        onSwipeLeft();
      } else {
        // Swiped right - go prev
        onSwipeRight();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  }, [onSwipeLeft, onSwipeRight, threshold]);

  const bind = React.useCallback(
    () => ({
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    }),
    [onTouchStart, onTouchMove, onTouchEnd],
  );

  return { bind };
}
