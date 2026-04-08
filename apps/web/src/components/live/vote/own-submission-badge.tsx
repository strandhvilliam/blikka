"use client";

import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export function OwnSubmissionBadge({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("VotingViewerPage");

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/45 via-black/10 to-transparent" />
      <div
        className={cn(
          "pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-amber-500/95 text-white shadow-lg backdrop-blur-sm",
          compact
            ? "px-2.5 py-1 text-[10px] font-semibold"
            : "px-3 py-1.5 text-xs font-semibold",
          className,
        )}
      >
        <Camera className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        <span>{t("ownSubmissionBadge.label")}</span>
      </div>
    </>
  );
}
