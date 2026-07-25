import { Heart, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compareParticipantReferences } from '@/lib/jury/jury-utils'

export interface JuryShortlistRow {
  participantId: number
  isWinner: boolean
  participant: {
    reference: string
  }
}

/**
 * The juror's shortlist is an unordered set, so it renders by participant reference — the order the
 * juror happened to pick in carries no meaning and would read as a ranking.
 */
export function JuryShortlistSummary({ shortlist }: { shortlist: JuryShortlistRow[] }) {
  const winner = shortlist.find((pick) => pick.isWinner) ?? null
  const sorted = shortlist.toSorted((left, right) =>
    compareParticipantReferences(left.participant, right.participant),
  )

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2.5',
          winner
            ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30'
            : 'border-border/60 bg-muted/20',
        )}
      >
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            winner ? 'bg-amber-400 text-amber-950' : 'bg-muted text-muted-foreground',
          )}
        >
          <Trophy className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Winner
          </p>
          <p className="truncate text-[13px] font-semibold tabular-nums">
            {winner ? `#${winner.participant.reference}` : 'Not selected'}
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-6 text-center">
          <p className="text-[13px] text-muted-foreground">Nothing shortlisted yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Shortlisted ({sorted.length}) &middot; no ranked order
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sorted.map((pick) => (
              <span
                key={pick.participantId}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium tabular-nums',
                  pick.isWinner
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30'
                    : 'border-border/60 bg-background',
                )}
              >
                {pick.isWinner ? (
                  <Trophy className="h-3 w-3 text-amber-600" />
                ) : (
                  <Heart className="h-3 w-3 fill-brand-primary text-brand-primary" />
                )}
                #{pick.participant.reference}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
