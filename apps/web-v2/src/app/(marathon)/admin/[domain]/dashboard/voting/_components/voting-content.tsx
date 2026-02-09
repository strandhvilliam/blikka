"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VotingHeader } from "./voting-header";
import { VotingSetup } from "./voting-setup";
import { VotingProgress } from "./voting-progress";
import { LeaderboardTab } from "./leaderboard-tab";
import { VotersTab } from "./voters-tab";
import { InviteDialog } from "./invite-dialog";
import { tabTriggerClassName } from "./voting-utils";

type VotingTabValue = "leaderboard" | "voters";

const PAGE_SIZE = 50;

export function VotingContent() {
  const domain = useDomain();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  );

  const activeTopic =
    marathon.topics.find((topic) => topic.visibility === "active") ?? null;
  const isByCamera = marathon.mode === "by-camera";

  const [activeTab, setActiveTab] = useState<VotingTabValue>("leaderboard");
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [votersPage, setVotersPage] = useState(1);

  useEffect(() => {
    setActiveTab("leaderboard");
    setLeaderboardPage(1);
    setVotersPage(1);
  }, [activeTopic?.id]);

  const summaryQueryOptions = trpc.voting.getVotingAdminSummary.queryOptions({
    domain,
    topicId: activeTopic?.id ?? 0,
  });

  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    error: summaryError,
  } = useQuery({
    ...summaryQueryOptions,
    enabled: isByCamera && !!activeTopic,
  });

  const hasSessions = (summary?.sessionStats.total ?? 0) > 0;

  const leaderboardQueryOptions = trpc.voting.getVotingLeaderboardPage.queryOptions(
    {
      domain,
      topicId: activeTopic?.id ?? 0,
      page: leaderboardPage,
      limit: PAGE_SIZE,
    },
  );

  const {
    data: leaderboardPageData,
    isLoading: isLeaderboardLoading,
    isError: isLeaderboardError,
    error: leaderboardError,
    isFetching: isLeaderboardFetching,
  } = useQuery({
    ...leaderboardQueryOptions,
    enabled:
      isByCamera &&
      !!activeTopic &&
      !!summary &&
      hasSessions &&
      activeTab === "leaderboard",
  });

  const votersQueryOptions = trpc.voting.getVotingVotersPage.queryOptions({
    domain,
    topicId: activeTopic?.id ?? 0,
    page: votersPage,
    limit: PAGE_SIZE,
  });

  const {
    data: votersPageData,
    isLoading: isVotersLoading,
    isError: isVotersError,
    error: votersError,
    isFetching: isVotersFetching,
  } = useQuery({
    ...votersQueryOptions,
    enabled:
      isByCamera &&
      !!activeTopic &&
      !!summary &&
      hasSessions &&
      activeTab === "voters",
  });

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

  const startVotingMutation = useMutation(
    trpc.voting.startVotingSessions.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting sessions started successfully");
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
        ]);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start voting sessions");
      },
    }),
  );

  const createManualVotingMutation = useMutation(
    trpc.voting.createManualVotingSession.mutationOptions({
      onSuccess: async (data) => {
        setCreatedInviteUrl(data.votingUrl);
        toast.success("Manual voting invite created");
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingVotersPage.pathKey(),
          }),
        ]);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create manual invite");
      },
    }),
  );

  const resendVotingSessionNotificationMutation = useMutation(
    trpc.voting.resendVotingSessionNotification.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting notification resent");
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingVotersPage.pathKey(),
          }),
        ]);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to resend voting notification");
      },
    }),
  );

  const submissionCount = summary?.submissionStats.submissionCount ?? 0;
  const participantWithSubmissionCount =
    summary?.submissionStats.participantWithSubmissionCount ?? 0;

  const completionRate = useMemo(() => {
    const total = summary?.sessionStats.total ?? 0;
    if (total === 0) return 0;
    return Math.round(((summary?.sessionStats.completed ?? 0) / total) * 100);
  }, [summary?.sessionStats.completed, summary?.sessionStats.total]);

  const totalSessions = summary?.sessionStats.total ?? 0;
  const completedSessions = summary?.sessionStats.completed ?? 0;
  const pendingSessions = summary?.sessionStats.pending ?? 0;

  const pendingResendSessionId =
    resendVotingSessionNotificationMutation.isPending
      ? resendVotingSessionNotificationMutation.variables?.sessionId
      : null;

  const leaderboardPageCount = leaderboardPageData?.pageCount ?? 0;
  const votersPageCount = votersPageData?.pageCount ?? 0;

  useEffect(() => {
    if (leaderboardPageCount > 0 && leaderboardPage > leaderboardPageCount) {
      setLeaderboardPage(leaderboardPageCount);
    }
  }, [leaderboardPage, leaderboardPageCount]);

  useEffect(() => {
    if (votersPageCount > 0 && votersPage > votersPageCount) {
      setVotersPage(votersPageCount);
    }
  }, [votersPage, votersPageCount]);

  const handleStartVoting = async (startsAt: string, endsAt: string) => {
    if (!activeTopic) {
      toast.error("No active by-camera topic found");
      return;
    }

    startVotingMutation.mutate({
      domain,
      topicId: activeTopic.id,
      startsAt,
      endsAt,
    });
  };

  const handleOpenInviteDialog = () => {
    setCreatedInviteUrl(null);
    setIsInviteDialogOpen(true);
  };

  const handleCreateManualInvite = (data: {
    firstName: string;
    lastName: string;
    email: string;
    startsAt: string;
    endsAt: string;
  }) => {
    if (!activeTopic) {
      toast.error("No active by-camera topic found");
      return;
    }

    createManualVotingMutation.mutate({
      domain,
      topicId: activeTopic.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    });
  };

  const handleCopySessionToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    toast.success("Token copied to clipboard");
  };

  const handleResendSessionNotification = (sessionId: number) => {
    if (!activeTopic) {
      toast.error("No active by-camera topic found");
      return;
    }

    resendVotingSessionNotificationMutation.mutate({
      domain,
      topicId: activeTopic.id,
      sessionId,
    });
  };

  if (!isByCamera) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">
            Voting
          </h1>
          <p className="text-muted-foreground text-sm">
            Voting administration is available only for marathons running in
            by-camera mode.
          </p>
        </div>

        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Voting unavailable</AlertTitle>
          <AlertDescription>
            Current marathon mode is <strong>{marathon.mode}</strong>. Switch to
            by-camera mode to enable voting sessions and leaderboard management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!activeTopic) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">
            Voting
          </h1>
          <p className="text-muted-foreground text-sm">
            No active topic is currently available.
          </p>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing active topic</AlertTitle>
          <AlertDescription>
            Activate a by-camera topic in Topics before starting voting.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <VotingHeader
        topicName={activeTopic.name}
        topicOrderIndex={activeTopic.orderIndex}
        hasSessions={hasSessions}
        isOverviewLoading={isSummaryLoading}
        onOpenInviteDialog={handleOpenInviteDialog}
      />

      {isSummaryError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load voting overview</AlertTitle>
          <AlertDescription>
            {summaryError?.message ||
              "An unknown error occurred while loading voting data."}
          </AlertDescription>
        </Alert>
      ) : null}

      {isSummaryLoading ? (
        <Card className="border-dashed">
          <CardContent className="py-8 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading voting overview...
          </CardContent>
        </Card>
      ) : null}

      {!isSummaryLoading && !isSummaryError && !!summary && !hasSessions ? (
        <VotingSetup
          topicName={activeTopic.name}
          submissionCount={submissionCount}
          participantWithSubmissionCount={participantWithSubmissionCount}
          onStartVoting={handleStartVoting}
          isStarting={startVotingMutation.isPending}
        />
      ) : null}

      {!isSummaryLoading && !isSummaryError && !!summary && hasSessions ? (
        <>
          <VotingProgress
            totalSessions={totalSessions}
            completedSessions={completedSessions}
            pendingSessions={pendingSessions}
            completionRate={completionRate}
          />

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as VotingTabValue)}
            className="space-y-0"
          >
            <div className="border-b border-border">
              <TabsList className="bg-transparent rounded-none p-0 h-auto flex gap-8 -mb-px">
                <TabsTrigger value="leaderboard" className={tabTriggerClassName}>
                  Leaderboard
                </TabsTrigger>
                <TabsTrigger value="voters" className={tabTriggerClassName}>
                  Voters
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="leaderboard" className="mt-6 space-y-6">
              {isLeaderboardError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Failed to load leaderboard</AlertTitle>
                  <AlertDescription>
                    {leaderboardError?.message ||
                      "An unknown error occurred while loading leaderboard data."}
                  </AlertDescription>
                </Alert>
              ) : null}

              <LeaderboardTab
                totalVotes={summary.voteStats.totalVotes}
                topRanks={summary.topRanks}
                leaderboard={leaderboardPageData?.items ?? []}
                page={leaderboardPage}
                pageCount={leaderboardPageCount}
                total={leaderboardPageData?.total ?? 0}
                isPageLoading={isLeaderboardLoading || isLeaderboardFetching}
                onPreviousPage={() =>
                  setLeaderboardPage((current) => Math.max(1, current - 1))
                }
                onNextPage={() =>
                  setLeaderboardPage((current) =>
                    leaderboardPageCount > 0
                      ? Math.min(leaderboardPageCount, current + 1)
                      : current + 1,
                  )
                }
              />
            </TabsContent>

            <TabsContent value="voters" className="mt-6">
              {isVotersError ? (
                <Alert variant="destructive" className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Failed to load voters</AlertTitle>
                  <AlertDescription>
                    {votersError?.message ||
                      "An unknown error occurred while loading voters."}
                  </AlertDescription>
                </Alert>
              ) : null}

              <VotersTab
                voters={votersPageData?.items ?? []}
                page={votersPage}
                pageCount={votersPageCount}
                total={votersPageData?.total ?? 0}
                isPageLoading={isVotersLoading || isVotersFetching}
                onPreviousPage={() =>
                  setVotersPage((current) => Math.max(1, current - 1))
                }
                onNextPage={() =>
                  setVotersPage((current) =>
                    votersPageCount > 0
                      ? Math.min(votersPageCount, current + 1)
                      : current + 1,
                  )
                }
                onCopyToken={handleCopySessionToken}
                onResendNotification={handleResendSessionNotification}
                pendingResendSessionId={pendingResendSessionId ?? null}
                isResending={resendVotingSessionNotificationMutation.isPending}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <InviteDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onCreateInvite={handleCreateManualInvite}
        createdInviteUrl={createdInviteUrl}
        votingWindowStartsAt={summary?.votingWindow.startsAt}
        votingWindowEndsAt={summary?.votingWindow.endsAt}
        isCreating={createManualVotingMutation.isPending}
        onReset={() => setCreatedInviteUrl(null)}
      />
    </div>
  );
}
