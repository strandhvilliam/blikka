'use client'

import { useState } from 'react'
import { Heart, Trophy } from 'lucide-react'
import { compareParticipantReferences } from '@/lib/jury/jury-utils'
import { JuryResultPhoto, getJuryParticipantDisplayName, type JuryResultParticipant } from './jury-result-photo'
import { JuryResultPhotoDialog } from './jury-result-photo-dialog'

export interface JuryResultShortlistRow {
  participantId: number
  isWinner: boolean
  participant: JuryResultParticipant
}

/**
 * The juror's verdict, which is what an admin opens this page for: the winning photo first, then the
 * rest of the shortlist. The shortlist is an unordered set, so it renders by participant reference —
 * the order the juror happened to pick in carries no meaning and would read as a ranking.
 */
export function JuryResultOutcome({
  shortlist,
  requiredShortlistSize,
}: {
  shortlist: JuryResultShortlistRow[]
  requiredShortlistSize: number
}) {
  const [previewParticipant, setPreviewParticipant] = useState<JuryResultParticipant | null>(null)

  const winner = shortlist.find((pick) => pick.isWinner) ?? null
  const runnersUp = shortlist
    .filter((pick) => !pick.isWinner)
    .toSorted((left, right) => compareParticipantReferences(left.participant, right.participant))

  return (
    <div className="space-y-4">
      {winner ? (
        <button
          type="button"
          onClick={() => setPreviewParticipant(winner.participant)}
          className="group block w-full overflow-hidden rounded-xl border border-amber-200 bg-amber-50 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 dark:border-amber-900/60 dark:bg-amber-950/30"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/40 sm:aspect-[16/9]">
            <JuryResultPhoto
              participant={winner.participant}
              priority
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-950 shadow-sm">
              <Trophy className="h-3 w-3" />
              Winner
            </span>
          </div>
          <div className="flex min-w-0 items-baseline gap-2 px-4 py-3">
            <span className="text-base font-semibold tabular-nums">
              #{winner.participant.reference}
            </span>
            <span className="min-w-0 truncate text-[13px] text-muted-foreground">
              {getJuryParticipantDisplayName(winner.participant)}
            </span>
          </div>
        </button>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Trophy className="h-4 w-4" />
          </div>
          <p className="text-[13px] font-medium">No winner picked yet</p>
          <p className="max-w-[280px] text-[12px] text-muted-foreground">
            The juror picks a winner out of their shortlist when they submit their review.
          </p>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Shortlist
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {shortlist.length} / {requiredShortlistSize} &middot; no ranked order
          </span>
        </div>

        {runnersUp.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-6 text-center">
            <p className="text-[13px] text-muted-foreground">
              {winner ? 'Nothing else shortlisted.' : 'Nothing shortlisted yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {runnersUp.map((pick) => (
              <button
                key={pick.participantId}
                type="button"
                onClick={() => setPreviewParticipant(pick.participant)}
                className="group overflow-hidden rounded-lg border border-border/60 bg-background text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35"
                title={getJuryParticipantDisplayName(pick.participant)}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-muted/40">
                  <JuryResultPhoto
                    participant={pick.participant}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex min-w-0 items-center gap-1 px-2 py-1.5">
                  <Heart className="h-3 w-3 shrink-0 fill-brand-primary text-brand-primary" />
                  <span className="min-w-0 truncate text-[12px] font-medium tabular-nums">
                    #{pick.participant.reference}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <JuryResultPhotoDialog
        participant={previewParticipant}
        onOpenChange={(open) => {
          if (!open) setPreviewParticipant(null)
        }}
      />
    </div>
  )
}

