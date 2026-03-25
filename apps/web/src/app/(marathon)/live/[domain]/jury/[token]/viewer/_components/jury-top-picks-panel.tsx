"use client";

import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import type { JuryRatingsResponse } from "../../_lib/jury-types";
import type { JuryListParticipant } from "../_lib/jury-list-participant";
import {
  juryRankChipNeutralOccupied,
  juryRankChipNeutralPlaceholder,
} from "../_lib/jury-rank-chip-classes";
import {
  getFinalRankingLabel,
  getRankAssignments,
} from "../_lib/jury-final-ranking-state";
import { JuryRankTrophyBadge } from "./jury-rank-trophy-badge";

export function JuryTopPicksPanel({
  ratings,
  participants,
  onParticipantSelect,
}: {
  ratings: JuryRatingsResponse["ratings"];
  participants: JuryListParticipant[];
  onParticipantSelect: (participantId: number, index: number) => void;
}) {
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
              onParticipantSelect(participantId, index);
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
                  assigned
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
