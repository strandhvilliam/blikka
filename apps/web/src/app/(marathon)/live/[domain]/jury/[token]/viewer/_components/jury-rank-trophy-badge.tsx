"use client";

import { Trophy } from "lucide-react";

const idleByRank: Record<1 | 2 | 3, string> = {
  1: "border-amber-200/90 bg-amber-100 text-amber-800",
  2: "border-zinc-300/95 bg-zinc-200/85 text-zinc-700",
  3: "border-orange-300/80 bg-orange-100 text-amber-950",
};

const wrapClass: Record<"md" | "sm", string> = {
  md: "h-7 w-7",
  sm: "h-5 w-5",
};

const iconClass: Record<"md" | "sm", string> = {
  md: "h-3.5 w-3.5",
  sm: "h-2.5 w-2.5",
};

export function JuryRankTrophyBadge({
  rank,
  tone = "idle",
  size = "md",
}: {
  rank: 1 | 2 | 3;
  tone?: "idle" | "active";
  size?: "md" | "sm";
}) {
  const palette =
    tone === "active"
      ? "border-white/30 bg-white/15 text-white"
      : idleByRank[rank];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${wrapClass[size]} ${palette}`}
      aria-hidden
    >
      <Trophy
        className={`shrink-0 ${iconClass[size]}`}
        strokeWidth={size === "sm" ? 2.5 : 2.25}
      />
    </span>
  );
}
