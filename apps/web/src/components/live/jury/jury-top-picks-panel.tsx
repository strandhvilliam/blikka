"use client";

import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import type { JuryListParticipant, JuryRatingsResponse } from "@/app/(marathon)/live/[domain]/jury/[token]/_lib/jury-types";
import {
  getFinalRankingLabel,
  getRankAssignments,
  juryRankChipNeutralOccupied,
  juryRankChipNeutralPlaceholder,
} from "@/app/(marathon)/live/[domain]/jury/[token]/_lib/jury-utils";
import { JuryRankTrophyBadge } from "./jury-rank-trophy-badge";
import { useJuryReviewQueryState } from "@/app/(marathon)/live/[domain]/jury/[token]/viewer/_hooks/use-jury-review-query-state";

export function JuryTopPicksPanel({
  ratings,
  participants,
}: {
  ratings: JuryRatingsResponse["ratings"];
  participants: JuryListParticipant[];
}) {
  const { selectParticipant } = useJuryReviewQueryState();
  const rankAssignments = useMemo(() => getRankAssignments(ratings), [ratings]);
  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );
  const assignedCount = rankAssignments.size;
  const isComplete = assignedCount === 3;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium text-brand-black">
          Your Top 3
        </p>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            isComplete
              ? "border-brand-primary/20 bg-brand-primary/5 text-brand-primary"
              : "border-border/60 bg-neutral-50 text-brand-gray"
          }`}
        >
          {isComplete ? <CheckCircle2 className="h-3 w-3" /> : null}
          {assignedCount}/3
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([1, 2, 3] as const).map((rank) => {
          const participantId = rankAssignments.get(rank) ?? null;
          const participant =
            participantId !== null
              ? (participantMap.get(participantId) ?? null)
              : null;

          if (participantId === null) {
            return (
              <span
                key={rank}
                className={`${juryRankChipNeutralPlaceholder} cursor-default`}
              >
                <JuryRankTrophyBadge rank={rank} tone="idle" />
                {getFinalRankingLabel(rank)}
                <span className="text-xs font-normal text-brand-gray">
                  Not Set
                </span>
              </span>
            );
          }

          const canNavigate = participant !== null;
          const handleClick = () => {
            if (!canNavigate) return;
            const index = participants.findIndex(
              (p) => p.id === participantId,
            );
            if (index >= 0) {
              selectParticipant(participantId, index);
            }
          };

          return (
            <button
              key={rank}
              type="button"
              onClick={handleClick}
              disabled={!canNavigate}
              className={`${juryRankChipNeutralOccupied} disabled:pointer-events-none disabled:opacity-50`}
            >
              <JuryRankTrophyBadge rank={rank} tone="idle" />
              {getFinalRankingLabel(rank)}
              {participant ? (
                <span className="text-xs font-normal text-brand-gray">
                  #{participant.reference}
                </span>
              ) : (
                <span className="text-xs font-normal text-brand-gray">
                  Not Set
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
