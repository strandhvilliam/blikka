"use client";

import { ImageIcon, Star } from "lucide-react";
import type { JuryListParticipant } from "../_lib/jury-list-participant";
import { getFinalRankingLabel } from "../_lib/jury-final-ranking-state";
import { getParticipantPreview } from "../_lib/jury-list-participant";
import { juryRankChipCardBadge } from "../_lib/jury-rank-chip-classes";
import { JuryRankTrophyBadge } from "./jury-rank-trophy-badge";

export function JuryParticipantCard({
  participant,
  rating,
  finalRanking,
  onClick,
}: {
  participant: JuryListParticipant;
  rating: number;
  finalRanking: 1 | 2 | 3 | null;
  onClick: () => void;
}) {
  const previewUrl = getParticipantPreview(participant);

  return (
    <button
      type="button"
      className="group flex w-full cursor-pointer items-stretch gap-0 overflow-hidden rounded-xl border border-border/60 bg-white text-left transition-all duration-200 hover:border-brand-primary/30 hover:shadow-[0_4px_24px_rgba(254,77,58,0.08)]"
      onClick={onClick}
    >
      <div className="h-auto w-24 shrink-0 overflow-hidden bg-neutral-100 sm:w-28">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`Preview for ${participant.reference}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full min-h-24 w-full items-center justify-center text-brand-gray/50">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-2 px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-rocgrotesk text-xl font-bold tracking-tight text-brand-black">
              {participant.reference}
            </h3>
            {finalRanking !== null ? (
              <span
                className={`${juryRankChipCardBadge} pointer-events-none tracking-wide`}
              >
                <JuryRankTrophyBadge rank={finalRanking} tone="idle" size="sm" />
                {getFinalRankingLabel(finalRanking)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={
                  star <= rating
                    ? "h-3.5 w-3.5 fill-brand-primary text-brand-primary"
                    : "h-3.5 w-3.5 text-border"
                }
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {participant.competitionClass?.name ? (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-brand-black/70">
              {participant.competitionClass.name}
            </span>
          ) : null}
          {participant.deviceGroup?.name ? (
            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-brand-gray">
              {participant.deviceGroup.name}
            </span>
          ) : null}
          {participant.submission?.topic?.name ? (
            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-brand-gray">
              {participant.submission.topic.name}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
