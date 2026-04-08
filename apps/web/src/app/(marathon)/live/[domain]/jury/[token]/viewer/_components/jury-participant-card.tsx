"use client"

import { ImageIcon, Star } from "lucide-react"
import type { JuryListParticipant, ViewMode } from "../../_lib/jury-types"
import {
  getFinalRankingLabel,
  getParticipantPreview,
  juryRankChipCardBadge,
} from "../../_lib/jury-utils"
import { JuryRankTrophyBadge } from "./jury-rank-trophy-badge"

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "xs" }) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3"
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={
            star <= rating
              ? `${iconClass} fill-brand-primary text-brand-primary`
              : `${iconClass} text-border`
          }
        />
      ))}
    </div>
  )
}

function CompactCard({
  participant,
  rating,
  finalRanking,
  onClick,
}: {
  participant: JuryListParticipant
  rating: number
  finalRanking: 1 | 2 | 3 | null
  onClick: () => void
}) {
  const previewUrl = getParticipantPreview(participant)

  return (
    <button
      type="button"
      className="group flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-white px-3 py-2.5 text-left transition-all duration-200 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]"
      onClick={onClick}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`Preview for ${participant.reference}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-gray/40">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-gothic text-base font-bold tracking-tight text-brand-black">
              {participant.reference}
            </span>
            {finalRanking !== null ? (
              <span
                className={`${juryRankChipCardBadge} pointer-events-none scale-90 tracking-wide`}
              >
                <JuryRankTrophyBadge rank={finalRanking} tone="idle" size="sm" />
                {getFinalRankingLabel(finalRanking)}
              </span>
            ) : null}
          </div>
          <StarRating rating={rating} size="xs" />
        </div>
        <div className="flex flex-wrap gap-1">
          {participant.competitionClass?.name ? (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-brand-black/60">
              {participant.competitionClass.name}
            </span>
          ) : null}
          {participant.deviceGroup?.name ? (
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-brand-gray">
              {participant.deviceGroup.name}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function GridCard({
  participant,
  rating,
  finalRanking,
  onClick,
}: {
  participant: JuryListParticipant
  rating: number
  finalRanking: 1 | 2 | 3 | null
  onClick: () => void
}) {
  const previewUrl = getParticipantPreview(participant)

  return (
    <button
      type="button"
      className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-white text-left transition-all duration-200 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]"
      onClick={onClick}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`Preview for ${participant.reference}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-gray/30">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-gothic text-base font-bold tracking-tight text-brand-black">
              {participant.reference}
            </span>
            {finalRanking !== null ? (
              <span
                className={`${juryRankChipCardBadge} pointer-events-none scale-90 tracking-wide`}
              >
                <JuryRankTrophyBadge rank={finalRanking} tone="idle" size="sm" />
                {getFinalRankingLabel(finalRanking)}
              </span>
            ) : null}
          </div>
          <StarRating rating={rating} size="xs" />
        </div>
        <div className="flex flex-wrap gap-1">
          {participant.competitionClass?.name ? (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-brand-black/60">
              {participant.competitionClass.name}
            </span>
          ) : null}
          {participant.deviceGroup?.name ? (
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-brand-gray">
              {participant.deviceGroup.name}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

export function JuryParticipantCard({
  participant,
  rating,
  finalRanking,
  onClick,
  variant = "grid",
}: {
  participant: JuryListParticipant
  rating: number
  finalRanking: 1 | 2 | 3 | null
  onClick: () => void
  variant?: ViewMode
}) {
  if (variant === "grid") {
    return (
      <GridCard
        participant={participant}
        rating={rating}
        finalRanking={finalRanking}
        onClick={onClick}
      />
    )
  }

  return (
    <CompactCard
      participant={participant}
      rating={rating}
      finalRanking={finalRanking}
      onClick={onClick}
    />
  )
}
