"use client"

import { useMemo, useSyncExternalStore } from "react"
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
} from "@/components/ui/alert-dialog"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useJuryReviewData } from "./jury-review-data-provider"
import {
  getAssignedFinalRankingCount,
  getFinalRankingLabel,
  getJuryCompletedPath,
  getRankAssignments,
  hasCompleteFinalRankings,
  juryRankChipNeutralOccupied,
  juryRankChipNeutralPlaceholder,
} from "@/app/(marathon)/live/[domain]/jury/[token]/_lib/jury-utils"
import { JuryRankTrophyBadge } from "./jury-rank-trophy-badge"
import { useDomain } from "@/lib/domain-provider"
import { useJuryClientToken } from "./jury-client-token-provider"
import { useJuryReviewQueryState } from "@/app/(marathon)/live/[domain]/jury/[token]/viewer/_hooks/use-jury-review-query-state"
import dynamic from "next/dynamic"

const ProgressRing = dynamic(() => import("./jury-progress-ring").then((mod) => mod.ProgressRing), {
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
  const ratings = ratingsData.ratings
  const ratedCount = ratings.length
  const assignedFinalRankingCount = getAssignedFinalRankingCount(ratings)
  const canCompleteReview = isClientReady && hasCompleteFinalRankings(ratings)
  const queryClient = useQueryClient()
  const router = useRouter()

  const completeMutation = useMutation(
    trpc.jury.updateInvitationStatusByToken.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.jury.pathKey(),
        })
        toast.success("Review completed")
        router.push(getJuryCompletedPath(domain, token))
      },
      onError: (error) => {
        toast.error(error.message || "Failed to complete review")
      },
    }),
  )

  const rankAssignments = useMemo(() => getRankAssignments(ratings), [ratings])
  const participantMap = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants])
  const topPicksCount = rankAssignments.size
  const topPicksComplete = topPicksCount === 3
  const headerRatedCount = isClientReady ? ratedCount : 0
  const headerTotalParticipants = isClientReady ? totalParticipants : 0
  const headerAssignedFinalCount = isClientReady ? assignedFinalRankingCount : 0
  const headerTopPicksCount = isClientReady ? topPicksCount : 0
  const headerTopPicksComplete = isClientReady && topPicksComplete

  const sessionInitials = useMemo(() => {
    const parts = invitation.displayName.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) {
      const word = parts[0]!
      return word.slice(0, 2).toUpperCase()
    }
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
  }, [invitation.displayName])

  return (
    <header className="rounded-2xl border border-border/60 bg-white">
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <ProgressRing rated={headerRatedCount} total={headerTotalParticipants} />
          <div>
            <h1 className="font-gothic text-2xl font-bold tracking-tight text-brand-black">
              Jury Review
            </h1>
            <p className="mt-0.5 text-sm text-brand-gray">{invitation.marathon.name}</p>
          </div>
          <div className="ml-2 hidden flex-wrap gap-1.5 lg:flex">
            {invitation.topic?.name ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-black/70">
                {invitation.topic.name}
              </span>
            ) : null}
            {invitation.competitionClass?.name ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-black/70">
                {invitation.competitionClass.name}
              </span>
            ) : null}
            {invitation.deviceGroup?.name ? (
              <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray">
                {invitation.deviceGroup.name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:flex-initial">
          <div className="flex min-w-0 max-w-full items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 px-3.5 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:px-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-white font-gothic text-[13px] font-bold tracking-tight text-brand-black"
              aria-hidden
            >
              {sessionInitials}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
                Your session
              </p>
              <p className="font-gothic truncate text-sm font-bold tracking-tight text-brand-black">
                {invitation.displayName}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-border/50 bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-brand-black/75">
                  {headerRatedCount}/{headerTotalParticipants} rated
                </span>
                <span className="inline-flex items-center rounded-full border border-border/50 bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-brand-black/75">
                  Top picks {headerAssignedFinalCount}/3
                </span>
              </div>
            </div>
          </div>

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
                      status: "completed",
                    })
                  }
                >
                  {completeMutation.isPending ? "Completing..." : "Complete review"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-brand-black">Your Top 3</p>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              headerTopPicksComplete
                ? "border-brand-primary/20 bg-brand-primary/5 text-brand-primary"
                : "border-border/60 bg-neutral-50 text-brand-gray"
            }`}
          >
            {headerTopPicksComplete ? <CheckCircle2 className="h-3 w-3" /> : null}
            {headerTopPicksCount}/3
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([1, 2, 3] as const).map((rank) => {
            if (!isClientReady) {
              return (
                <span key={rank} className={`${juryRankChipNeutralPlaceholder} cursor-default`}>
                  <JuryRankTrophyBadge rank={rank} tone="idle" />
                  {getFinalRankingLabel(rank)}
                  <span className="text-xs font-normal text-brand-gray">Not Set</span>
                </span>
              )
            }

            const participantId = rankAssignments.get(rank) ?? null
            const participant =
              participantId !== null ? (participantMap.get(participantId) ?? null) : null

            if (participantId === null) {
              return (
                <span key={rank} className={`${juryRankChipNeutralPlaceholder} cursor-default`}>
                  <JuryRankTrophyBadge rank={rank} tone="idle" />
                  {getFinalRankingLabel(rank)}
                  <span className="text-xs font-normal text-brand-gray">Not Set</span>
                </span>
              )
            }

            const canNavigate = participant !== null
            const handleClick = () => {
              if (!canNavigate) return
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
                  <span className="text-xs font-normal text-brand-gray">Not Set</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
