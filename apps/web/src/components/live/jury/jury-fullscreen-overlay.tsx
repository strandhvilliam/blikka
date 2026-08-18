'use client'

import { ChevronLeft, ChevronRight, Loader2, MessageSquare, Star } from 'lucide-react'
import type { JuryInvitation, JuryListParticipant } from '@/lib/jury/jury-types'
import { JuryPickBadge } from './jury-pick-badge'
import type { JurySidebarShortlistState } from './jury-sidebar'

const chipBase =
  'inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'

const chipActive = `${chipBase} border-brand-primary bg-brand-primary text-white`
const chipIdle = `${chipBase} border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/20`

/** Top-bar identity for the fullscreen viewer — who is on screen, and whether a write is in flight. */
export function JuryFullscreenLabel({
  participant,
  invitation,
  isSaving,
}: {
  participant: JuryListParticipant
  invitation: JuryInvitation
  isSaving: boolean
}) {
  const topicName = participant.submission?.topic?.name
  const className = participant.competitionClass?.name

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="font-gothic text-xl font-bold tracking-tight text-white">
        #{participant.reference}
      </span>
      {invitation.inviteType === 'class' ? null : topicName ? (
        <span className="hidden truncate rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80 sm:inline">
          {topicName}
        </span>
      ) : null}
      {className ? (
        <span className="hidden truncate rounded-full border border-white/20 px-2.5 py-0.5 text-xs font-medium text-white/70 sm:inline">
          {className}
        </span>
      ) : null}
      {isSaving ? (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-white/60">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving
        </span>
      ) : null}
    </div>
  )
}

export type JuryFullscreenOverlayProps = {
  rating: number
  onRatingClick: (star: number) => void
  hasNotes: boolean
  shortlist: JurySidebarShortlistState
  currentParticipantIndex: number
  loadedParticipantCount: number
  visibleTotal: number
  isFetchingNextPage: boolean
  onGoToPrev: () => void
  onGoToNext: () => void
}

/**
 * The review actions that matter with a photo at full size: rate it, pick it, page through. Notes
 * stay in the sidebar — typing under an auto-hiding bar fights the shortcuts that share those keys.
 */
export function JuryFullscreenOverlay({
  rating,
  onRatingClick,
  hasNotes,
  shortlist,
  currentParticipantIndex,
  loadedParticipantCount,
  visibleTotal,
  isFetchingNextPage,
  onGoToPrev,
  onGoToNext,
}: JuryFullscreenOverlayProps) {
  const isShortlistBlocked = !shortlist.isShortlisted && shortlist.isFull

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-label={`Rate ${star} of 5`}
                className="rounded-full p-1 transition-transform duration-100 hover:scale-110 active:scale-95"
                onClick={() => onRatingClick(star)}
              >
                <Star
                  className={`h-6 w-6 transition-colors duration-100 ${
                    star <= rating
                      ? 'fill-brand-primary text-brand-primary'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                />
              </button>
            ))}
          </div>
          <span className="min-w-14 text-xs tabular-nums text-white/60">
            {rating > 0 ? `${rating} of 5` : 'Unrated'}
          </span>
          {hasNotes ? (
            <span
              className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/70"
              title="This submission has notes"
            >
              <MessageSquare className="h-3 w-3" />
              Notes
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={shortlist.isShortlisted ? chipActive : chipIdle}
            onClick={shortlist.onToggleShortlist}
            disabled={shortlist.isSavingShortlist || isShortlistBlocked}
            aria-pressed={shortlist.isShortlisted}
          >
            <JuryPickBadge
              variant="shortlist"
              tone={shortlist.isShortlisted ? 'active' : 'idle'}
              size="sm"
            />
            {shortlist.isShortlisted ? 'Shortlisted' : 'Shortlist'}
          </button>

          <button
            type="button"
            className={shortlist.isWinner ? chipActive : chipIdle}
            onClick={shortlist.onWinnerClick}
            disabled={shortlist.isSavingShortlist || (!shortlist.isWinner && isShortlistBlocked)}
            aria-pressed={shortlist.isWinner}
          >
            <JuryPickBadge
              variant="winner"
              tone={shortlist.isWinner ? 'active' : 'idle'}
              size="sm"
            />
            {shortlist.isWinner ? 'Winner' : 'Pick winner'}
          </button>

          <span className="hidden text-[11px] tabular-nums text-white/50 sm:inline">
            {shortlist.shortlistCount}/{shortlist.requiredSize} picked
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
            disabled={currentParticipantIndex === 0}
            onClick={onGoToPrev}
            aria-label="Previous submission"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-gothic text-sm font-bold tabular-nums text-white">
            {currentParticipantIndex + 1}
            <span className="font-sans font-normal text-white/50">
              {' / '}
              {visibleTotal}
            </span>
          </span>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
            disabled={currentParticipantIndex >= loadedParticipantCount - 1}
            onClick={onGoToNext}
            aria-label="Next submission"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {isFetchingNextPage ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" aria-label="Loading more" />
          ) : null}
        </div>
      </div>

      <div className="hidden flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/45 md:flex">
        <FullscreenHint keys={['←', '→']} label="Navigate" />
        <FullscreenHint keys={['1', '–', '5']} label="Rate" />
        <FullscreenHint keys={['0']} label="Clear" />
        <FullscreenHint keys={['S']} label="Shortlist" />
        <FullscreenHint keys={['W']} label="Winner" />
        <FullscreenHint keys={['+', '−']} label="Zoom" />
        <FullscreenHint keys={['F']} label="Exit fullscreen" />
      </div>
    </div>
  )
}

function FullscreenHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5">
        {keys.map((key, index) =>
          key === '–' ? (
            <span key={index} className="text-white/30">
              –
            </span>
          ) : (
            <kbd
              key={index}
              className="inline-flex min-w-[18px] items-center justify-center rounded border border-white/25 bg-white/10 px-1 py-px font-mono text-[10px] leading-tight text-white/70"
            >
              {key}
            </kbd>
          ),
        )}
      </span>
      <span>{label}</span>
    </span>
  )
}
