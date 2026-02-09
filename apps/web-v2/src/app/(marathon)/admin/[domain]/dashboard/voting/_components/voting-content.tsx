"use client";

import { useMemo, useState } from "react";
import { addHours } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
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

  const overviewQueryOptions = trpc.voting.getVotingAdminOverview.queryOptions({
    domain,
    topicId: activeTopic?.id ?? 0,
  });

  const {
    data: overview,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    error: overviewError,
  } = useQuery({
    ...overviewQueryOptions,
    enabled: isByCamera && !!activeTopic,
  });

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

  const startVotingMutation = useMutation(
    trpc.voting.startVotingSessions.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting sessions started successfully");
        await queryClient.invalidateQueries({
          queryKey: overviewQueryOptions.queryKey,
        });
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
        await queryClient.invalidateQueries({
          queryKey: overviewQueryOptions.queryKey,
        });
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
        await queryClient.invalidateQueries({
          queryKey: overviewQueryOptions.queryKey,
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to resend voting notification");
      },
    }),
  );

  const hasSessions = (overview?.sessionStats.total ?? 0) > 0;
  const submissionCount = overview?.leaderboard.length ?? 0;
  const participantWithSubmissionCount = useMemo(() => {
    return new Set(
      overview?.leaderboard.map((entry) => entry.participantId) ?? [],
    ).size;
  }, [overview?.leaderboard]);

  const completionRate = useMemo(() => {
    const total = overview?.sessionStats.total ?? 0;
    if (total === 0) return 0;
    return Math.round(((overview?.sessionStats.completed ?? 0) / total) * 100);
  }, [overview?.sessionStats.completed, overview?.sessionStats.total]);

  const totalSessions = overview?.sessionStats.total ?? 0;
  const completedSessions = overview?.sessionStats.completed ?? 0;
  const pendingSessions = overview?.sessionStats.pending ?? 0;

  const pendingResendSessionId =
    resendVotingSessionNotificationMutation.isPending
      ? resendVotingSessionNotificationMutation.variables?.sessionId
      : null;

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
        isOverviewLoading={isOverviewLoading}
        onOpenInviteDialog={handleOpenInviteDialog}
      />

      {isOverviewError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load voting overview</AlertTitle>
          <AlertDescription>
            {overviewError?.message ||
              "An unknown error occurred while loading voting data."}
          </AlertDescription>
        </Alert>
      ) : null}

      {isOverviewLoading ? (
        <Card className="border-dashed">
          <CardContent className="py-8 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading voting overview...
          </CardContent>
        </Card>
      ) : null}

      {!isOverviewLoading && !isOverviewError && !!overview && !hasSessions ? (
        <VotingSetup
          topicName={activeTopic.name}
          submissionCount={submissionCount}
          participantWithSubmissionCount={participantWithSubmissionCount}
          onStartVoting={handleStartVoting}
          isStarting={startVotingMutation.isPending}
        />
      ) : null}

      {!isOverviewLoading && !isOverviewError && !!overview && hasSessions ? (
        <>
          <VotingProgress
            totalSessions={totalSessions}
            completedSessions={completedSessions}
            pendingSessions={pendingSessions}
            completionRate={completionRate}
          />

          <Tabs defaultValue="leaderboard" className="space-y-0">
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
              <LeaderboardTab
                totalVotes={overview.voteStats.totalVotes}
                topRanks={overview.topRanks}
                leaderboard={overview.leaderboard}
              />
            </TabsContent>

            <TabsContent value="voters" className="mt-6">
              <VotersTab
                voters={overview.voters}
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
        votingWindowStartsAt={overview?.votingWindow.startsAt}
        votingWindowEndsAt={overview?.votingWindow.endsAt}
        isCreating={createManualVotingMutation.isPending}
        onReset={() => setCreatedInviteUrl(null)}
      />
    </div>
  );
}
