"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, Heart } from "lucide-react";

interface VoteButtonProps {
  isSelected: boolean;
  isEnabled: boolean;
  onVote: () => void;
  onComplete?: () => void;
  showComplete: boolean;
  className?: string;
}

export function VoteButton({
  isSelected,
  isEnabled,
  onVote,
  onComplete,
  showComplete,
  className,
}: VoteButtonProps) {
  if (showComplete) {
    return (
      <button
        onClick={onComplete}
        className={cn(
          "w-full py-4 rounded-2xl font-medium text-base transition-all",
          "bg-green-500 text-white shadow-lg shadow-green-500/25",
          "active:scale-[0.98] active:shadow-md",
          className,
        )}
      >
        <span className="flex items-center justify-center gap-2">
          <Check className="w-5 h-5" />
          Complete Voting
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onVote}
      disabled={!isEnabled}
      className={cn(
        "w-full py-4 rounded-2xl font-medium text-base transition-all",
        isSelected
          ? "bg-foreground text-background shadow-lg"
          : "bg-muted text-foreground hover:bg-muted/80",
        !isEnabled && "opacity-50 cursor-not-allowed",
        "active:scale-[0.98]",
        className,
      )}
    >
      <span className="flex items-center justify-center gap-2">
        <Heart
          className={cn("w-5 h-5 transition-all", isSelected && "fill-current")}
        />
        {isSelected ? "Your Vote" : "Vote for this"}
      </span>
    </button>
  );
}
