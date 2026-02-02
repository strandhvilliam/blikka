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
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = (rating: number) => {
    onChange?.(rating);
  };

  const displayValue = hoverValue ?? value ?? 0;
  const activeLabel = hoverValue ?? value;

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-center">
          {[1, 2, 3, 4, 5].map((rating) => (
            <div key={rating} className="flex flex-col items-center gap-1 px-2">
              <Star className="w-10 h-10 text-muted-foreground/30" />
              <span className="text-[10px] font-medium text-muted-foreground/40">
                {rating}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Stars with integrated numbers below each */}
      <div
        className="flex items-center justify-center"
        onMouseLeave={() => setHoverValue(null)}
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => handleClick(rating)}
            onMouseEnter={() => setHoverValue(rating)}
            onTouchStart={() => setHoverValue(rating)}
            className="flex flex-col items-center gap-1 px-2"
            aria-label={`Rate ${rating} stars`}
          >
            <Star
              className={cn(
                "w-10 h-10 transition-all duration-150",
                displayValue >= rating
                  ? "text-yellow-400 fill-current scale-110"
                  : "text-muted-foreground/30",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium transition-colors",
                displayValue >= rating
                  ? "text-yellow-500"
                  : "text-muted-foreground/40",
              )}
            >
              {rating}
            </span>
          </button>
        ))}
      </div>

      {/* Simple rating indicator */}
      {/* <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {activeLabel ? (
            <span className="font-medium text-foreground">{activeLabel}/5</span>
          ) : (
            "Tap to rate"
          )}
        </p>
      </div> */}
    </div>
  );
}
