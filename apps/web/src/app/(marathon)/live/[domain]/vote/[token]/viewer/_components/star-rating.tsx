"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface StarRatingProps {
  value?: number;
  onChange?: (value: number) => void;
  className?: string;
}

export function StarRating({ value, onChange, className }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = (rating: number) => {
    if (!isMobile) setHoverValue(null);
    onChange?.(rating);
  };

  const displayValue = hoverValue ?? value ?? 0;


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
      <div
        className="flex items-center justify-center"
        onMouseLeave={() => !isMobile ? setHoverValue(null) : undefined}
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => handleClick(rating)}
            onMouseEnter={() => !isMobile ? setHoverValue(rating) : undefined}
            onTouchStart={() => !isMobile ? setHoverValue(rating) : undefined}
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

    </div>
  );
}
