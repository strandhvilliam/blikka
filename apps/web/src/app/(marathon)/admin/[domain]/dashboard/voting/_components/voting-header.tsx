"use client"

import type { Topic } from "@blikka/db"
import { RefreshCw, UserPlus, Vote } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InviteDialog } from "./invite-dialog"
import { useTRPC } from "@/lib/trpc/client"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useDomain } from "@/lib/domain-provider"
import { getVotingLifecycleState } from "@/lib/voting-lifecycle"

interface VotingHeaderProps {
  activeTopic: Topic
}

const STATE_BADGE_STYLES = {
  "not-started": "border-slate-200 bg-slate-50 text-slate-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ended: "border-amber-200 bg-amber-50 text-amber-700",
} as const

const STATE_LABELS = {
  "not-started": "Not Started",
  active: "Active",
  ended: "Ended",
} as const

export function VotingHeader({ activeTopic }: VotingHeaderProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)

  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  )

  const votingState = getVotingLifecycleState(summary.votingWindow)
  const currentRoundLabel = summary.currentRound
    ? summary.currentRound.kind === "tiebreak"
      ? `Tie-break ${summary.currentRound.roundNumber}`
      : `Round ${summary.currentRound.roundNumber}`
    : null

  const handleRefetch = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.voting.getVotingLeaderboardPage.pathKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.voting.getVotingRoundsForTopic.pathKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.voting.getVotingVotersPage.pathKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        }),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <>
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
            <Vote className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              By Camera
            </p>
            <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">Voting</h1>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Manage voting for{" "}
                <span className="font-medium text-foreground">{activeTopic.name}</span>
              </p>
              <Badge variant="secondary" className="text-[10px]">
                Topic {activeTopic.orderIndex + 1}
              </Badge>
              {currentRoundLabel && (
                <Badge variant="outline" className="text-[10px]">{currentRoundLabel}</Badge>
              )}
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATE_BADGE_STYLES[votingState]}`}
              >
                {STATE_LABELS[votingState]}
              </span>
            </div>
            {summary.currentRound?.kind === "tiebreak" && (
              <p className="text-[11px] text-muted-foreground/70">
                Latest round is a tie-break. Only the tied leading submissions are eligible.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/70">
              Manual invites are available only while voting is active.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefetch}
              disabled={isRefreshing}
              className="text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInviteDialogOpen(true)}
              disabled={votingState !== "active"}
              className="text-xs"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Invite Voter
            </Button>
          </div>
        </div>
      </section>

      <InviteDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        activeTopic={activeTopic}
      />
    </>
  )
}
