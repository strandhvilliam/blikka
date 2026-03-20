"use client";

import type { Topic } from "@blikka/db";
import { RefreshCw, UserPlus, Vote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteDialog } from "./invite-dialog";
import { useTRPC } from "@/lib/trpc/client";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDomain } from "@/lib/domain-provider";
import { getVotingLifecycleState } from "@/lib/voting-lifecycle";

interface VotingHeaderProps {
  activeTopic: Topic;
}

const STATE_BADGE_STYLES = {
  "not-started": "border-slate-200 bg-slate-100 text-slate-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ended: "border-amber-200 bg-amber-50 text-amber-700",
} as const;

const STATE_LABELS = {
  "not-started": "Not Started",
  active: "Active",
  ended: "Ended",
} as const;

export function VotingHeader({ activeTopic }: VotingHeaderProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const domain = useDomain();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  );

  const votingState = getVotingLifecycleState(summary.votingWindow);
  const currentRoundLabel = summary.currentRound
    ? summary.currentRound.kind === "tiebreak"
      ? `Tie-break ${summary.currentRound.roundNumber}`
      : `Round ${summary.currentRound.roundNumber}`
    : null;

  const handleRefetch = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.voting.getVotingLeaderboardPage.pathKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.voting.getVotingVotersPage.pathKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-gothic text-3xl font-bold tracking-tight">
                Voting
              </h1>
              <Badge variant="secondary">
                <Vote className="mr-1 h-3 w-3" />
                Topic {activeTopic.orderIndex + 1}
              </Badge>
              {currentRoundLabel ? (
                <Badge variant="outline">{currentRoundLabel}</Badge>
              ) : null}
              <Badge variant="outline">By Camera</Badge>
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATE_BADGE_STYLES[votingState]}`}
              >
                {STATE_LABELS[votingState]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage voting for{" "}
              <span className="font-medium text-foreground">
                {activeTopic.name}
              </span>
              .
            </p>
            {summary.currentRound?.kind === "tiebreak" ? (
              <p className="text-xs text-muted-foreground">
                Latest round is a tie-break. Only the tied leading submissions
                are eligible.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Manual invites are available only while voting is active.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={handleRefetch}
              disabled={isRefreshing}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(true)}
              disabled={votingState !== "active"}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Manual Voter
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
  );
}
