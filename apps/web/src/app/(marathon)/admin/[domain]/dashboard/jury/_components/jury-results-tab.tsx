'use client'

import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Gavel, Trophy } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { groupJuryResultsByScope, type JuryScopeGroup } from '@/lib/jury/jury-results'
import { cn } from '@/lib/utils'
import { JuryResultPhoto, getJuryParticipantDisplayName, type JuryResultParticipant } from './jury-result-photo'
import { JuryResultPhotoDialog } from './jury-result-photo-dialog'

function JuryEntryTile({
  participant,
  caption,
  highlight = false,
  onSelect,
}: {
  participant: JuryResultParticipant
  caption: string
  highlight?: boolean
  onSelect: (participant: JuryResultParticipant) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(participant)}
      title={getJuryParticipantDisplayName(participant)}
      className={cn(
        'group w-24 shrink-0 overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35',
        highlight
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30'
          : 'border-border/60 bg-background',
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted/40">
        <JuryResultPhoto
          participant={participant}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {highlight && (
          <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm">
            <Trophy className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="px-1.5 py-1">
        <p className="truncate text-[12px] font-semibold tabular-nums">#{participant.reference}</p>
        <p className="truncate text-[10px] text-muted-foreground">{caption}</p>
      </div>
    </button>
  )
}

function JuryScopeSection({
  group,
  onSelectParticipant,
}: {
  group: JuryScopeGroup
  onSelectParticipant: (participant: JuryResultParticipant) => void
}) {
  const jurorCount = group.jurors.length
  const completedCount = group.jurors.filter((juror) => juror.status === 'completed').length
  // Entries only one juror touched say nothing about agreement, so the strip keeps the shared ones.
  const agreedOn = group.consensus.filter((entry) => entry.wonBy > 0 || entry.shortlistedBy > 1)

  return (
    <section className="rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-3">
        <h3 className="text-[15px] font-medium tracking-tight font-gothic">{group.label}</h3>
        <p className="text-[12px] text-muted-foreground tabular-nums">
          {jurorCount} {jurorCount === 1 ? 'juror' : 'jurors'} &middot; {completedCount} completed
        </p>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Where the jury agrees
          </p>
          {agreedOn.length === 0 ? (
            <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-4 text-center text-[13px] text-muted-foreground">
              {jurorCount === 1
                ? 'Only one juror reviews this — see their picks below.'
                : 'No entry has a win or a shared shortlist spot yet.'}
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {agreedOn.map((entry) => (
                <JuryEntryTile
                  key={entry.participant.id}
                  participant={entry.participant}
                  highlight={entry.wonBy > 0}
                  caption={
                    entry.wonBy > 0
                      ? `${entry.wonBy} of ${jurorCount} won`
                      : `${entry.shortlistedBy} of ${jurorCount} picked`
                  }
                  onSelect={onSelectParticipant}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Each juror&apos;s winner
          </p>
          <div className="divide-y divide-border/40 rounded-lg border border-border/60">
            {group.jurors.map((juror) => (
              <div
                key={juror.invitationId}
                className="flex min-w-0 items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{juror.displayName}</p>
                  <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                    {juror.shortlist.length} shortlisted
                  </p>
                </div>
                {juror.winner ? (
                  <JuryEntryTile
                    participant={juror.winner}
                    highlight
                    caption={getJuryParticipantDisplayName(juror.winner)}
                    onSelect={onSelectParticipant}
                  />
                ) : (
                  <span className="shrink-0 text-[12px] text-muted-foreground">
                    No winner yet
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * The question this page could not answer before: for a topic or class, what did each juror decide
 * and where do they agree. One read covers the whole marathon, so it replaces clicking through
 * every invitation in turn.
 */
export function JuryResultsTab() {
  const domain = useDomain()
  const trpc = useTRPC()
  const [previewParticipant, setPreviewParticipant] = useState<JuryResultParticipant | null>(null)

  const { data: results } = useSuspenseQuery(
    trpc.jury.getJuryResultsByDomain.queryOptions({ domain }),
  )

  const groups = groupJuryResultsByScope(results)

  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center text-muted-foreground">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
          <Gavel className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <h2 className="mb-1 text-base font-medium font-gothic">No jury results yet</h2>
        <p className="max-w-[320px] text-[13px] text-muted-foreground/70">
          Invite jurors to a topic or a class, and their winners will be compared here.
        </p>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]]:min-w-0">
        <div className="box-border w-full min-w-0 space-y-4 p-4 sm:p-5">
          {groups.map((group) => (
            <JuryScopeSection
              key={group.key}
              group={group}
              onSelectParticipant={setPreviewParticipant}
            />
          ))}
        </div>
      </ScrollArea>

      <JuryResultPhotoDialog
        participant={previewParticipant}
        onOpenChange={(open) => {
          if (!open) setPreviewParticipant(null)
        }}
      />
    </>
  )
}

/** Placeholder while the domain-wide results load. */
export function JuryResultsTabSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-5">
      {[0, 1].map((index) => (
        <div key={index} className="rounded-xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex gap-2 p-4">
            {[0, 1, 2, 3].map((tile) => (
              <div key={tile} className="h-28 w-24 shrink-0 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

