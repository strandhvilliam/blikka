"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useClientReady } from "../_hooks/use-client-ready";

interface StarRatingProps {
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export function StarRating({
  value,
  onChange,
  disabled = false,
  className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const isClientReady = useClientReady();
  const isMobile = useIsMobile();
  const t = useTranslations("VotingViewerPage");

  const handleClick = (rating: number) => {
    if (disabled) return;
    if (!isMobile) setHoverValue(null);
    onChange?.(rating);
  };

  const displayValue = hoverValue ?? value ?? 0;

  if (!isClientReady) {
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
        onMouseLeave={() =>
          !isMobile && !disabled ? setHoverValue(null) : undefined
        }
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            disabled={disabled}
            onClick={() => handleClick(rating)}
            onMouseEnter={() =>
              !isMobile && !disabled ? setHoverValue(rating) : undefined
            }
            onTouchStart={() =>
              !isMobile && !disabled ? setHoverValue(rating) : undefined
            }
            className={cn(
              "flex flex-col items-center gap-1 px-2 transition-opacity disabled:cursor-not-allowed",
              disabled && "opacity-45",
            )}
            aria-label={t("starRating.rateStars", { rating })}
            aria-disabled={disabled}
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
