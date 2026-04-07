"use client"

import { useMemo } from "react"
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
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getJuryCompletedPath } from "../../_lib/jury-paths"
import type { JuryInvitation, JuryRatingsResponse } from "../../_lib/jury-types"
import type { JuryListParticipant } from "../_lib/jury-list-participant"
import {
  juryRankChipNeutralOccupied,
  juryRankChipNeutralPlaceholder,
} from "../_lib/jury-rank-chip-classes"
import {
  getFinalRankingLabel,
  getRankAssignments,
} from "../_lib/jury-final-ranking-state"
import { JuryRankTrophyBadge } from "./jury-rank-trophy-badge"
import { ProgressRing } from "./jury-progress-ring"
import { useDomain } from "@/lib/domain-provider"
import { useJuryClientToken } from "../../_components/jury-client-token-provider"

export function JuryReviewHeader({
  invitation,
  ratedCount,
  totalParticipants,
  assignedFinalRankingCount,
  canCompleteReview,
  ratings,
  participants,
  onParticipantSelect,
}: {
  invitation: JuryInvitation
  ratedCount: number
  totalParticipants: number
  assignedFinalRankingCount: number
  canCompleteReview: boolean
  ratings: JuryRatingsResponse["ratings"]
  participants: JuryListParticipant[]
  onParticipantSelect: (participantId: number, index: number) => void
}) {
  const domain = useDomain()
  const token = useJuryClientToken()
  const trpc = useTRPC()
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
  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  )
  const topPicksCount = rankAssignments.size
  const topPicksComplete = topPicksCount === 3

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
          <ProgressRing rated={ratedCount} total={totalParticipants} />
          <div>
            <h1 className="font-gothic text-2xl font-bold tracking-tight text-brand-black">
              Jury Review
            </h1>
            <p className="mt-0.5 text-sm text-brand-gray">
              {invitation.marathon.name}
            </p>
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
                  {ratedCount}/{totalParticipants} rated
                </span>
                <span className="inline-flex items-center rounded-full border border-border/50 bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-brand-black/75">
                  Top picks {assignedFinalRankingCount}/3
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
                  You must choose 1st, 2nd, and 3rd place before completing this
                  review. You will no longer be able to edit ratings after
                  marking it as completed.
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
                  {completeMutation.isPending
                    ? "Completing..."
                    : "Complete review"}
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
              topPicksComplete
                ? "border-brand-primary/20 bg-brand-primary/5 text-brand-primary"
                : "border-border/60 bg-neutral-50 text-brand-gray"
            }`}
          >
            {topPicksComplete ? <CheckCircle2 className="h-3 w-3" /> : null}
            {topPicksCount}/3
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([1, 2, 3] as const).map((rank) => {
            const participantId = rankAssignments.get(rank) ?? null
            const participant =
              participantId !== null
                ? (participantMap.get(participantId) ?? null)
                : null

            if (participantId === null) {
              return (
                <span
                  key={rank}
                  className={`${juryRankChipNeutralPlaceholder} cursor-default`}
                >
                  <JuryRankTrophyBadge rank={rank} tone="idle" />
                  {getFinalRankingLabel(rank)}
                  <span className="text-xs font-normal text-brand-gray">
                    Not Set
                  </span>
                </span>
              )
            }

            const canNavigate = participant !== null
            const handleClick = () => {
              if (!canNavigate) return
              const index = participants.findIndex(
                (p) => p.id === participantId,
              )
              if (index >= 0) {
                onParticipantSelect(participantId, index)
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
                  <span className="text-xs font-normal text-brand-gray">
                    Not Set
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
