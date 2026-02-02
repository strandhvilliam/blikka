"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Star, LayoutGrid, Info } from "lucide-react";
import { VotingInfoDrawer } from "./voting-info-drawer";

interface FilterBarProps {
  currentFilter: number | null;
  onFilterChange: (filter: number | null) => void;
  ratingCounts: Record<number, number>;
  currentIndex: number;
  totalCount: number;
  viewMode: "carousel" | "grid";
  onViewModeChange: (mode: "carousel" | "grid") => void;
  ratedCount: number;
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
  viewMode,
  onViewModeChange,
  ratedCount,
  className,
}: FilterBarProps) {
  const progress = Math.round(((currentIndex + 1) / totalCount) * 100);

  const renderFilterOption = (option: (typeof filterOptions)[number]) => {
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
        {option.value !== null && <Star className="w-3 h-3 fill-current" />}
        {option.label}
        {count > 0 && <span className="ml-0.5 opacity-60">({count})</span>}
      </button>
    );
  };

  return (
    <div className={cn("px-4 py-3", className)}>
      {/* Top action bar with Info, Logo, and Grid buttons */}
      <div className="flex items-center justify-between mb-3">
        <VotingInfoDrawer votingInfo={{ rated: ratedCount, total: totalCount }}>
          <button
            className="h-10 w-10 rounded-xl bg-muted/50 border-0 shadow-sm hover:bg-muted active:scale-[0.98] flex items-center justify-center transition-all"
            aria-label="How voting works"
          >
            <Info className="w-5 h-5" />
          </button>
        </VotingInfoDrawer>

        {/* Logo */}
        <div className="flex items-center gap-1.5">
          <Image
            src="/blikka-logo.svg"
            alt="Blikka"
            width={20}
            height={17}
            className="w-5 h-[17px]"
          />
          <span className="font-rocgrotesk font-bold text-base tracking-tight">
            blikka
          </span>
        </div>

        <button
          onClick={() =>
            onViewModeChange(viewMode === "carousel" ? "grid" : "carousel")
          }
          className="h-10 w-10 rounded-xl bg-muted/50 border-0 shadow-sm hover:bg-muted active:scale-[0.98] flex items-center justify-center transition-all"
          aria-label={
            viewMode === "carousel" ? "Show grid view" : "Show carousel view"
          }
        >
          <LayoutGrid className="w-5 h-5" />
        </button>
      </div>

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
          return renderFilterOption(option);
        })}
      </div>
    </div>
  );
}
