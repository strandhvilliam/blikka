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
import { useTRPC } from '@/lib/trpc/client'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useJuryReviewData } from './jury-review-data-provider'
import {
  getDisplayInitials,
  getJuryCompletedPath,
  getRankAssignments,
  hasCompleteFinalRankings,
} from '@/lib/jury/jury-utils'
import { cn } from '@/lib/utils'
import { JuryRankTrophyBadge } from './jury-rank-trophy-badge'
import { useDomain } from '@/lib/domain-provider'
import { useJuryClientToken } from './jury-client-token-provider'
import { useJuryReviewQueryState } from '@/hooks/live/jury/use-jury-review-query-state'
import dynamic from 'next/dynamic'

const ProgressRing = dynamic(() => import('./jury-progress-ring').then((mod) => mod.ProgressRing), {
  ssr: false,
})

const noopSubscribe = () => () => {}

const PODIUM_SLOTS: Record<1 | 2 | 3, { label: string; filled: string }> = {
  1: {
    label: '1st place',
    filled: 'border-amber-200 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-50',
  },
  2: {
    label: '2nd place',
    filled: 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-100/70',
  },
  3: {
    label: '3rd place',
    filled: 'border-orange-200 bg-orange-50/70 hover:border-orange-300 hover:bg-orange-50',
  },
}

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
  const ratings = ratingsData.ratings
  const ratedCount = ratings.length
  const canCompleteReview = isClientReady && hasCompleteFinalRankings(ratings)
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

  const rankAssignments = getRankAssignments(ratings)
  const participantMap = new Map(participants.map((p) => [p.id, p]))
  const topPicksCount = rankAssignments.size
  const topPicksComplete = topPicksCount === 3
  const headerRatedCount = isClientReady ? ratedCount : 0
  const headerTotalParticipants = isClientReady ? totalParticipants : 0
  const headerTopPicksCount = isClientReady ? topPicksCount : 0
  const headerTopPicksComplete = isClientReady && topPicksComplete

  const sessionInitials = getDisplayInitials(invitation.displayName)

  const contextChips = [
    invitation.topic?.name,
    invitation.competitionClass?.name,
    invitation.deviceGroup?.name,
  ].filter((value): value is string => Boolean(value))

  return (
    <header className="overflow-hidden rounded-2xl border border-border/60 bg-white">
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="shrink-0"
            title="Share of participants with any saved review. Completing requires 1st, 2nd, and 3rd place."
          >
            <ProgressRing rated={headerRatedCount} total={headerTotalParticipants} />
          </div>
          <div className="min-w-0">
            <h1 className="font-gothic text-2xl font-bold leading-none tracking-tight text-brand-black">
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 font-gothic text-[13px] font-bold tracking-tight text-brand-primary"
              aria-hidden
            >
              {sessionInitials}
            </div>
            <div className="min-w-0 text-right sm:text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
                Your session
              </p>
              <p className="font-gothic truncate text-sm font-bold leading-tight tracking-tight text-brand-black">
                {invitation.displayName}
              </p>
              <p
                className="text-[11px] tabular-nums text-brand-gray"
                title="Any saved note, star rating, or top-3 pick counts as reviewed"
              >
                {headerRatedCount}/{headerTotalParticipants} reviewed
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
                  You must choose 1st, 2nd, and 3rd place before completing this review. You will no
                  longer be able to edit ratings after marking it as completed.
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
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-gray">
              Top 3 Picks
            </p>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums',
                headerTopPicksComplete
                  ? 'border-brand-primary/20 bg-brand-primary/5 text-brand-primary'
                  : 'border-border/60 bg-white text-brand-gray',
              )}
            >
              {headerTopPicksComplete ? <CheckCircle2 className="h-3 w-3" /> : null}
              {headerTopPicksCount}/3
            </span>
          </div>
          {!headerTopPicksComplete && isClientReady ? (
            <p className="hidden text-[11px] text-brand-gray sm:block">
              Assign all three to complete the review
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([1, 2, 3] as const).map((rank) => {
            const slot = PODIUM_SLOTS[rank]
            const participantId = isClientReady ? (rankAssignments.get(rank) ?? null) : null
            const participant =
              participantId !== null ? (participantMap.get(participantId) ?? null) : null
            const isFilled = participant !== null

            const handleClick = () => {
              if (!isFilled || participantId === null) return
              const index = participants.findIndex((p) => p.id === participantId)
              if (index >= 0) {
                selectParticipant(participantId, index)
              }
            }

            return (
              <button
                key={rank}
                type="button"
                onClick={handleClick}
                disabled={!isFilled}
                aria-label={
                  isFilled
                    ? `${slot.label}: participant #${participant!.reference}. Open submission.`
                    : `${slot.label}: not assigned yet`
                }
                className={cn(
                  'flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-1',
                  isFilled
                    ? `cursor-pointer shadow-sm active:scale-[0.99] ${slot.filled}`
                    : 'cursor-default border-dashed border-border/70 bg-white/40',
                )}
              >
                <JuryRankTrophyBadge rank={rank} tone="idle" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
                    {slot.label}
                  </p>
                  {isFilled ? (
                    <p className="truncate font-gothic text-sm font-bold leading-tight tabular-nums text-brand-black">
                      #{participant!.reference}
                    </p>
                  ) : (
                    <p className="text-sm font-medium leading-tight text-brand-gray/70">Empty</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
