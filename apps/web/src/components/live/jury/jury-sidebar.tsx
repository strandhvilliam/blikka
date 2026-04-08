"use client"

import { Textarea } from "@/components/ui/textarea"
import { Keyboard, Loader2, MessageSquare, Star } from "lucide-react"
import type { ChangeEvent } from "react"
import type { JuryInvitation, JuryListParticipant } from "@/app/(marathon)/live/[domain]/jury/[token]/_lib/jury-types"
import {
  getFinalRankingLabel,
  juryRankChipActive,
  juryRankChipNeutralOccupied,
  juryRankChipNeutralSlot,
} from "@/app/(marathon)/live/[domain]/jury/[token]/_lib/jury-utils"
import { JuryRankTrophyBadge } from "./jury-rank-trophy-badge"

export function JurySidebar({
  participant,
  invitation,
  rating,
  notes,
  isSaving,
  onRatingClick,
  onNotesChange,
  localFinalRanking,
  rankOccupants,
  currentParticipantId,
  participants,
  onFinalRankingClick,
}: {
  participant: JuryListParticipant
  invitation: JuryInvitation
  rating: number
  notes: string
  isSaving: boolean
  onRatingClick: (star: number) => void
  onNotesChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  localFinalRanking: 1 | 2 | 3 | null
  rankOccupants: Map<number, number>
  currentParticipantId: number | null
  participants: JuryListParticipant[]
  onFinalRankingClick: (rank: 1 | 2 | 3) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <JurySidebarParticipantInfo
        participant={participant}
        invitation={invitation}
        isSaving={isSaving}
      />
      <JurySidebarStarRating rating={rating} onRatingClick={onRatingClick} />
      <JurySidebarFinalRanking
        participant={participant}
        localFinalRanking={localFinalRanking}
        rankOccupants={rankOccupants}
        currentParticipantId={currentParticipantId}
        participants={participants}
        onFinalRankingClick={onFinalRankingClick}
      />
      <JurySidebarNotes notes={notes} onNotesChange={onNotesChange} />
      <JurySidebarKeyboardShortcuts />
    </div>
  )
}

function JurySidebarParticipantInfo({
  participant,
  invitation,
  isSaving,
}: {
  participant: JuryListParticipant
  invitation: JuryInvitation
  isSaving: boolean
}) {
  return (
    <div className="px-5 pt-5 pb-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-gothic text-2xl font-bold tracking-tight text-brand-black">
          #{participant.reference}
        </h2>
        {isSaving ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-brand-gray">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {participant.submission?.topic?.name ? (
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-black/70">
            {participant.submission.topic.name}
          </span>
        ) : null}
        {participant.competitionClass?.name ? (
          <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray">
            {participant.competitionClass.name}
          </span>
        ) : null}
        {participant.deviceGroup?.name ? (
          <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray">
            {participant.deviceGroup.name}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-brand-gray">
        {invitation.inviteType === "class"
          ? "Review the generated contact sheet for this participant."
          : "Review the submission for the assigned topic."}
      </p>
    </div>
  )
}

function JurySidebarStarRating({
  rating,
  onRatingClick,
}: {
  rating: number
  onRatingClick: (star: number) => void
}) {
  return (
    <div className="border-t border-border/60 px-5 py-4">
      <p className="text-xs font-semibold tracking-wide text-brand-black/60 uppercase">
        Rating
      </p>
      <div className="mt-2.5 flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="rounded-full p-1.5 transition-transform duration-100 hover:scale-110 active:scale-95"
            onClick={() => onRatingClick(star)}
          >
            <Star
              className={`h-6 w-6 transition-colors duration-100 ${
                star <= rating
                  ? "fill-brand-primary text-brand-primary"
                  : "text-neutral-200 hover:text-neutral-300"
              }`}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-brand-gray">
        <span>{rating > 0 ? `${rating} of 5` : "Tap to rate"}</span>
        <span className="hidden text-brand-gray/50 sm:inline">
          &middot; Press <Kbd>1</Kbd>–<Kbd>5</Kbd> to rate, <Kbd>0</Kbd> to clear
        </span>
      </div>
    </div>
  )
}

function JurySidebarFinalRanking({
  participant,
  localFinalRanking,
  rankOccupants,
  currentParticipantId,
  participants,
  onFinalRankingClick,
}: {
  participant: JuryListParticipant
  localFinalRanking: 1 | 2 | 3 | null
  rankOccupants: Map<number, number>
  currentParticipantId: number | null
  participants: JuryListParticipant[]
  onFinalRankingClick: (rank: 1 | 2 | 3) => void
}) {
  return (
    <div className="border-t border-border/60 px-5 py-4">
      <p className="text-xs font-semibold tracking-wide text-brand-black/60 uppercase">
        Final ranking
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {([1, 2, 3] as const).map((rank) => {
          const isActive = localFinalRanking === rank
          const occupantId = rankOccupants.get(rank)
          const occupantRef =
            occupantId && !isActive
              ? participants.find((p) => p.id === occupantId)?.reference
              : null
          const isOccupiedByOther =
            occupantId !== undefined && occupantId !== currentParticipantId

          return (
            <button
              key={rank}
              type="button"
              className={
                isActive
                  ? juryRankChipActive
                  : isOccupiedByOther
                    ? juryRankChipNeutralOccupied
                    : juryRankChipNeutralSlot
              }
              onClick={() => onFinalRankingClick(rank)}
            >
              <JuryRankTrophyBadge
                rank={rank}
                tone={isActive ? "active" : "idle"}
              />
              {getFinalRankingLabel(rank)}
              {isActive ? (
                <span className="text-xs font-normal opacity-80">
                  #{participant.reference}
                </span>
              ) : occupantRef != null ? (
                <span className="text-xs font-normal text-brand-gray">
                  #{occupantRef}
                </span>
              ) : (
                <span className="text-xs font-normal text-brand-gray">
                  Not Set
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function JurySidebarNotes({
  notes,
  onNotesChange,
}: {
  notes: string
  onNotesChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border/60 px-5 py-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-brand-gray" />
        <p className="text-xs font-semibold tracking-wide text-brand-black/60 uppercase">
          Notes
        </p>
      </div>
      <Textarea
        placeholder="Your observations on this submission..."
        className="mt-2.5 min-h-28 flex-1 resize-none border-border/60 bg-neutral-50 text-sm placeholder:text-brand-gray/50 focus-visible:ring-brand-primary/20"
        value={notes}
        onChange={onNotesChange}
      />
    </div>
  )
}

function JurySidebarKeyboardShortcuts() {
  return (
    <div className="hidden border-t border-border/60 px-5 py-3 xl:block">
      <div className="flex items-center gap-1.5 text-[11px] text-brand-gray/60">
        <Keyboard className="h-3 w-3" />
        <span>Shortcuts</span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
        <ShortcutRow keys={["←", "→"]} label="Navigate" />
        <ShortcutRow keys={["1", "–", "5"]} label="Set rating" />
        <ShortcutRow keys={["[", "]"]} label="Adjust rating" />
        <ShortcutRow keys={["0"]} label="Clear rating" />
        <ShortcutRow keys={["Esc"]} label="Back to list" />
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center rounded border border-border/80 bg-neutral-50 px-1 py-px font-mono text-[10px] leading-tight text-brand-black/70">
      {children}
    </kbd>
  )
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="flex items-center gap-0.5">
        {keys.map((key, i) =>
          key === "–" ? (
            <span key={i} className="text-brand-gray/40">–</span>
          ) : (
            <Kbd key={i}>{key}</Kbd>
          ),
        )}
      </span>
      <span className="text-brand-gray/60">{label}</span>
    </div>
  )
}
