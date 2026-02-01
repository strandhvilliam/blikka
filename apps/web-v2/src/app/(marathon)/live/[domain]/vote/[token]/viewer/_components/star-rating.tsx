"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface StarRatingProps {
  value?: number;
  onChange?: (value: number) => void;
  className?: string;
}

export function StarRating({ value, onChange, className }: StarRatingProps) {
  const [hoverValue, setHoverValue] = React.useState<number | null>(null);

  const handleClick = (rating: number) => {
    onChange?.(rating);
  };

  const displayValue = hoverValue ?? value ?? 0;

  return (
    <div
      className={cn("flex items-center justify-center gap-1", className)}
      onMouseLeave={() => setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => handleClick(rating)}
          onMouseEnter={() => setHoverValue(rating)}
          onTouchStart={() => setHoverValue(rating)}
          className={cn(
            "p-2 transition-transform duration-150 active:scale-90",
            displayValue >= rating
              ? "text-yellow-400"
              : "text-muted-foreground/30",
          )}
          aria-label={`Rate ${rating} stars`}
        >
          <Star
            className={cn(
              "w-10 h-10 transition-all duration-150",
              displayValue >= rating && "fill-current",
            )}
          />
        </button>
      ))}
    </div>
  );
}
