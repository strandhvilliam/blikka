"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface FilterBarProps {
  currentFilter: number | null;
  onFilterChange: (filter: number | null) => void;
  ratingCounts: Record<number, number>;
  currentIndex: number;
  totalCount: number;
  className?: string;
}

const filterOptions = [
  { value: null, label: "All" },
  { value: 5, label: "5" },
  { value: 4, label: "4" },
  { value: 3, label: "3" },
  { value: 2, label: "2" },
  { value: 1, label: "1" },
];

export function FilterBar({
  currentFilter,
  onFilterChange,
  ratingCounts,
  currentIndex,
  totalCount,
  className,
}: FilterBarProps) {
  const progress = Math.round(((currentIndex + 1) / totalCount) * 100);

  return (
    <div className={cn("px-4 py-3", className)}>
      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span className="font-medium text-foreground">
            {currentIndex + 1} <span className="text-muted-foreground">of</span>{" "}
            {totalCount}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Filter options - always visible */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {filterOptions.map((option) => {
          const count =
            option.value === null
              ? Object.values(ratingCounts).reduce((a, b) => a + b, 0)
              : ratingCounts[option.value] || 0;
          const isActive = currentFilter === option.value;

          return (
            <button
              key={String(option.value)}
              onClick={() => onFilterChange(option.value)}
              className={cn(
                "flex items-center gap-0.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0",
                isActive
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {option.value !== null && (
                <Star className="w-3 h-3 fill-current" />
              )}
              {option.label}
              {count > 0 && (
                <span className="ml-0.5 opacity-60">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
