'use client'

import { useSyncExternalStore } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PrimaryButton } from '@/components/ui/primary-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTRPC } from '@/lib/trpc/client'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useJuryReviewData } from './jury-review-data-provider'
import { getDisplayInitials, getJuryCompletedPath } from '@/lib/jury/jury-utils'
import { cn } from '@/lib/utils'
import { JuryPickBadge } from './jury-pick-badge'
import { useDomain } from '@/lib/domain-provider'
import { useJuryClientToken } from './jury-client-token-provider'
import { useJuryReviewQueryState } from '@/hooks/live/jury/use-jury-review-query-state'
import { useJuryShortlist } from '@/hooks/live/jury/use-jury-shortlist'
import dynamic from 'next/dynamic'

const ProgressRing = dynamic(() => import('./jury-progress-ring').then((mod) => mod.ProgressRing), {
  ssr: false,
})

const noopSubscribe = () => () => {}

export function JuryReviewHeader() {
  const isClientReady = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )

  const { selectParticipant } = useJuryReviewQueryState()
  const { participants, reviewSetTotalParticipants: totalParticipants } = useJuryReviewData()
  const domain = useDomain()
  const token = useJuryClientToken()
  const trpc = useTRPC()
  const { data: invitation } = useSuspenseQuery(
    trpc.jury.verifyTokenAndGetInitialData.queryOptions({ domain, token }),
  )
  const { data: ratingsData } = useSuspenseQuery(
    trpc.jury.getJuryRatingsByInvitation.queryOptions({ domain, token }),
  )
  const {
    picks,
    shortlistedIds,
    winnerParticipantId,
    count: shortlistCount,
    requiredSize,
    isComplete,
  } = useJuryShortlist({ domain, token })

  // "Reviewed" is any trace the juror left on a submission — a star, a note, or a shortlist pick.
  const reviewedIds = new Set(ratingsData.ratings.map((rating) => rating.participantId))
  for (const participantId of shortlistedIds) {
    reviewedIds.add(participantId)
  }

  const queryClient = useQueryClient()
  const router = useRouter()

  const completeMutation = useMutation(
    trpc.jury.updateInvitationStatusByToken.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.jury.pathKey(),
        })
        toast.success('Review completed')
        router.push(getJuryCompletedPath(domain, token))
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to complete review')
      },
    }),
  )

  const canCompleteReview = isClientReady && isComplete
  const headerReviewedCount = isClientReady ? reviewedIds.size : 0
  const headerTotalParticipants = isClientReady ? totalParticipants : 0
  const headerShortlistCount = isClientReady ? shortlistCount : 0
  const headerShortlistFull = isClientReady && shortlistCount >= requiredSize
  const headerWinnerReference = isClientReady
    ? (picks.find((pick) => pick.isWinner)?.reference ?? null)
    : null

  const sessionInitials = getDisplayInitials(invitation.displayName)

  const contextChips = [
    invitation.topic?.name,
    invitation.competitionClass?.name,
    invitation.deviceGroup?.name,
  ].filter((value): value is string => Boolean(value))

  const openParticipant = (participantId: number) => {
    const index = participants.findIndex((participant) => participant.id === participantId)
    if (index >= 0) {
      selectParticipant(participantId, index)
    }
  }

  return (
    <header className="shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-white">
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="shrink-0 cursor-default">
                <ProgressRing rated={headerReviewedCount} total={headerTotalParticipants} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              Share of participants you have left any mark on. Completing requires a full shortlist
              with a winner picked.
            </TooltipContent>
          </Tooltip>
          <div className="min-w-0">
            <h1 className="font-gothic text-2xl font-medium leading-none tracking-tight text-brand-black">
              Jury Review
            </h1>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm text-brand-gray">{invitation.marathon.name}</span>
              {contextChips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-black/70"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 font-gothic text-[13px] font-medium tracking-tight text-brand-primary"
              aria-hidden
            >
              {sessionInitials}
            </div>
            <div className="min-w-0 text-right sm:text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
                Your session
              </p>
              <p className="font-gothic truncate text-sm font-medium leading-tight tracking-tight text-brand-black">
                {invitation.displayName}
              </p>
              <p
                className="text-[11px] tabular-nums text-brand-gray"
                title="Any saved note, star rating, or shortlist pick counts as reviewed"
              >
                {headerReviewedCount}/{headerTotalParticipants} reviewed
              </p>
            </div>
          </div>

          <div className="h-10 w-px shrink-0 bg-border/60" aria-hidden />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <PrimaryButton disabled={!canCompleteReview}>
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </PrimaryButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Complete review</AlertDialogTitle>
                <AlertDialogDescription>
                  You are submitting {requiredSize} shortlisted submissions with #
                  {headerWinnerReference} as your winner. You will no longer be able to edit your
                  review after marking it as completed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={completeMutation.isPending}
                  onClick={() =>
                    completeMutation.mutate({
                      token,
                      domain,
                      status: 'completed',
                    })
                  }
                >
                  {completeMutation.isPending ? 'Completing...' : 'Complete review'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="border-t border-border/60 bg-muted/20 px-5 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-gray">
              Your Shortlist
            </p>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums',
                headerShortlistFull
                  ? 'border-brand-primary/20 bg-brand-primary/5 text-brand-primary'
                  : 'border-border/60 bg-white text-brand-gray',
              )}
            >
              {headerShortlistFull ? <CheckCircle2 className="h-3 w-3" /> : null}
              {headerShortlistCount}/{requiredSize}
            </span>
            <span className="hidden text-[11px] text-brand-gray sm:inline">in no ranked order</span>
          </div>

          <div
            className={cn(
              'inline-flex min-w-0 items-center gap-2 rounded-full border px-2.5 py-1',
              headerWinnerReference !== null
                ? 'border-amber-200 bg-amber-50/80'
                : 'border-dashed border-border/70 bg-white/40',
            )}
          >
            <JuryPickBadge variant="winner" size="sm" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
              Winner
            </span>
            {headerWinnerReference !== null ? (
              <button
                type="button"
                onClick={() => winnerParticipantId !== null && openParticipant(winnerParticipantId)}
                className="font-gothic truncate text-sm font-medium leading-tight tabular-nums text-brand-black hover:text-brand-primary"
              >
                #{headerWinnerReference}
              </button>
            ) : (
              <span className="text-sm font-medium leading-tight text-brand-gray/70">
                Not picked
              </span>
            )}
          </div>
        </div>

        {headerShortlistCount === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 bg-white/40 px-3 py-3 text-center text-[13px] text-brand-gray">
            Open a submission and hit <ShortcutKey>S</ShortcutKey> to shortlist it, then{' '}
            <ShortcutKey>W</ShortcutKey> to make one of your picks the winner.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {picks.map((pick) => (
              <button
                key={pick.participantId}
                type="button"
                onClick={() => openParticipant(pick.participantId)}
                aria-label={`Shortlisted #${pick.reference}${pick.isWinner ? ' — your winner' : ''}. Open submission.`}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm font-medium tabular-nums shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-1 active:scale-[0.98]',
                  pick.isWinner
                    ? 'border-amber-200 bg-amber-50/80 text-brand-black hover:border-amber-300'
                    : 'border-border/60 bg-white text-brand-black hover:border-brand-primary/40',
                )}
              >
                <JuryPickBadge variant={pick.isWinner ? 'winner' : 'shortlist'} size="sm" />#
                {pick.reference}
              </button>
            ))}

            {Array.from(
              { length: Math.max(0, requiredSize - headerShortlistCount) },
              (_, index) => (
                <span
                  key={`empty-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border/70 bg-white/40 px-2.5 py-1.5 text-sm font-medium text-brand-gray/60"
                >
                  Empty
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </header>
  )
}

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center rounded border border-border/80 bg-white px-1 py-px font-mono text-[10px] leading-tight text-brand-black/70">
      {children}
    </kbd>
  )
}
