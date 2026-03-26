import { useEffect } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Check,
  Copy,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  ExternalLink,
  MoreVertical,
  Trash2,
  X,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PrimaryButton } from "@/components/ui/primary-button";
import { getVotingLifecycleState } from "@/lib/voting-lifecycle";
import {
  formatDateTime,
  getSubmissionImageUrl,
  VOTING_PAGE_SIZE,
} from "../_lib/utils";
import { useVotingUiState } from "../_hooks/use-voting-ui-state";
import { formatDomainLink } from "@/lib/utils";
import { VotingProgress } from "./voting-progress";

interface VotersTabProps {
  activeTopic: { id: number; name: string; orderIndex: number };
}

export function VotersTab({ activeTopic }: VotersTabProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const domain = useDomain();
  const { votersPage, setVotersPage } = useVotingUiState();

  const handleCopySessionLink = async (token: string) => {
    const link = formatDomainLink(`/live/vote/${token}`, domain, "live");
    await navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  };

  const clearVoteMutation = useMutation(
    trpc.voting.clearVote.mutationOptions({
      onSuccess: async () => {
        toast.success("Vote cleared successfully");
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingVotersPage.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingLeaderboardPage.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingRoundsForTopic.pathKey(),
          }),
        ]);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to clear vote");
      },
    }),
  );

  const deleteVotingSessionMutation = useMutation(
    trpc.voting.deleteVotingSession.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting session deleted successfully");
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingVotersPage.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingLeaderboardPage.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingRoundsForTopic.pathKey(),
          }),
        ]);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete voting session");
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

  const startVotingSessionsForParticipantsMutation = useMutation(
    trpc.voting.startVotingSessionsForParticipants.mutationOptions({
      onSuccess: async (data) => {
        toast.success(
          `Voting sessions created for ${data.sessionsCreated} participant${data.sessionsCreated === 1 ? "" : "s"}`,
        );
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingVotersPage.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingLeaderboardPage.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingRoundsForTopic.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getParticipantsWithoutVotingSession.pathKey(),
          }),
        ]);
      },
      onError: (error) => {
        toast.error(
          error.message || "Failed to start voting sessions for participants",
        );
      },
    }),
  );

  const handleClearVote = (sessionId: number) => {
    clearVoteMutation.mutate({
      domain,
      topicId: activeTopic.id,
      sessionId,
    });
  };

  const handleDeleteSession = (sessionId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this voting session? This action cannot be undone.",
      )
    ) {
      return;
    }

    deleteVotingSessionMutation.mutate({
      domain,
      topicId: activeTopic.id,
      sessionId,
    });
  };

  const handleResendSessionNotification = (sessionId: number) => {
    resendVotingSessionNotificationMutation.mutate({
      domain,
      topicId: activeTopic.id,
      sessionId,
    });
  };

  const pendingClearVoteSessionId = clearVoteMutation.isPending
    ? (clearVoteMutation.variables?.sessionId ?? null)
    : null;
  const isClearingVote = clearVoteMutation.isPending;

  const pendingDeleteSessionId = deleteVotingSessionMutation.isPending
    ? (deleteVotingSessionMutation.variables?.sessionId ?? null)
    : null;
  const isDeletingSession = deleteVotingSessionMutation.isPending;

  const pendingResendSessionId =
    resendVotingSessionNotificationMutation.isPending
      ? resendVotingSessionNotificationMutation.variables?.sessionId
      : null;
  const isResending = resendVotingSessionNotificationMutation.isPending;

  const { data: votersPageData } = useSuspenseQuery(
    trpc.voting.getVotingVotersPage.queryOptions({
      domain,
      topicId: activeTopic.id,
      page: votersPage,
      limit: VOTING_PAGE_SIZE,
    }),
  );

  const { data: participantsWithoutSession = [] } = useSuspenseQuery(
    trpc.voting.getParticipantsWithoutVotingSession.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  );
  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  );

  const voters = votersPageData?.items ?? [];
  const pageCount = votersPageData?.pageCount ?? 0;
  const total = votersPageData?.total ?? 0;
  const votingState = getVotingLifecycleState(summary.votingWindow);

  useEffect(() => {
    if (pageCount > 0 && votersPage > pageCount) {
      setVotersPage(pageCount);
    }
  }, [pageCount, votersPage, setVotersPage]);

  return (
    <div className="space-y-4">
      {summary.currentRound ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">
            {summary.currentRound.kind === "tiebreak"
              ? `Tie-break ${summary.currentRound.roundNumber}`
              : `Round ${summary.currentRound.roundNumber}`}
          </Badge>
          {summary.currentRound.kind === "tiebreak" ? (
            <span>Vote status below reflects the active tie-break round.</span>
          ) : null}
        </div>
      ) : null}
      <VotingProgress activeTopic={activeTopic} />
      {participantsWithoutSession.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <UserPlus className="h-4 w-4" />
          <AlertTitle>Participants without voting sessions</AlertTitle>
          <AlertDescription>
            <div className="space-y-3 mt-2">
              <p>
                {participantsWithoutSession.length} participant
                {participantsWithoutSession.length === 1 ? "" : "s"} have
                uploaded for this topic but don&apos;t have voting sessions yet
                (voting was started before they uploaded).
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {participantsWithoutSession.map((p) => (
                  <li key={p.id}>
                    {p.reference ? (
                      <Link
                        href={`/admin/${domain}/dashboard/submissions/${p.reference}`}
                        className="hover:underline"
                      >
                        {p.firstname} {p.lastname} ({p.reference})
                      </Link>
                    ) : (
                      <>
                        {p.firstname} {p.lastname}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <PrimaryButton
                onClick={() =>
                  startVotingSessionsForParticipantsMutation.mutate({
                    domain,
                    topicId: activeTopic.id,
                    participantIds: participantsWithoutSession.map((p) => p.id),
                  })
                }
                disabled={
                  startVotingSessionsForParticipantsMutation.isPending ||
                  votingState !== "active"
                }
              >
                {startVotingSessionsForParticipantsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Start voting sessions for these participants
                  </>
                )}
              </PrimaryButton>
              {votingState !== "active" ? (
                <p className="text-sm">
                  Late participant sessions can only be started while voting is
                  active.
                </p>
              ) : null}
            </div>
          </AlertDescription>
        </Alert>
      )}
      <div>
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Voter
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Token
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Email
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Phone
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Vote
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-right text-xs font-semibold text-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voters.length ? (
                  voters.map((voter) => (
                    <TableRow
                      key={voter.sessionId}
                      className="border-b transition-colors hover:bg-muted/60"
                    >
                      <TableCell className="py-2">
                        <div className="space-y-1 flex items-center gap-2">
                          <p className="font-medium">
                            {voter.firstName} {voter.lastName}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {voter.connectedParticipantId
                              ? "Participant"
                              : "Manual"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <code className="font-mono text-xs">{voter.token}</code>
                      </TableCell>
                      <TableCell className="py-2">
                        {voter.email || "-"}
                      </TableCell>
                      <TableCell className="py-2">
                        {voter.phoneNumber || "-"}
                      </TableCell>
                      <TableCell className="py-2">
                        {voter.voteSubmission ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex">
                                <Badge
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-emerald-600/90 bg-emerald-600 text-white border-0 shadow-sm"
                                >
                                  <Check className="mr-1.5 size-3.5 shrink-0" />
                                  {voter.voteSubmission.participantReference ||
                                    "Unknown"}
                                </Badge>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4" align="start">
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <h4 className="font-semibold text-sm">
                                    Voted Submission
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    Participant:{" "}
                                    {voter.voteSubmission
                                      .participantReference || "Unknown"}
                                  </p>
                                  {voter.voteSubmission.participantFirstName &&
                                    voter.voteSubmission
                                      .participantLastName && (
                                      <p className="text-xs text-muted-foreground">
                                        {
                                          voter.voteSubmission
                                            .participantFirstName
                                        }{" "}
                                        {
                                          voter.voteSubmission
                                            .participantLastName
                                        }
                                      </p>
                                    )}
                                  <p className="text-xs text-muted-foreground">
                                    Submitted:{" "}
                                    {formatDateTime(
                                      voter.voteSubmission.createdAt,
                                    )}
                                  </p>
                                </div>
                                {voter.voteSubmission.thumbnailKey ||
                                voter.voteSubmission.key ? (
                                  <div className="rounded-lg overflow-hidden border bg-muted">
                                    <img
                                      src={getSubmissionImageUrl(
                                        voter.voteSubmission.thumbnailKey,
                                        voter.voteSubmission.key,
                                      )}
                                      alt={`Submission by ${voter.voteSubmission.participantReference || "Unknown"}`}
                                      className="w-full h-auto object-contain max-h-64"
                                    />
                                  </div>
                                ) : (
                                  <div className="rounded-lg border bg-muted h-32 flex items-center justify-center">
                                    <p className="text-xs text-muted-foreground">
                                      No image available
                                    </p>
                                  </div>
                                )}
                                {voter.voteSubmission.participantReference && (
                                  <Link
                                    href={`/admin/${domain}/dashboard/submissions/${voter.voteSubmission.participantReference}/${voter.voteSubmission.submissionId}`}
                                  >
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full"
                                    >
                                      <ExternalLink className="mr-2 size-4" />
                                      View Submission
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Not voted
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={() => handleCopySessionLink(voter.token)}
                          >
                            <Copy className="mr-1.5 size-3.5" />
                            Copy Link
                          </Button>

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                disabled={isResending}
                              >
                                {pendingResendSessionId === voter.sessionId ? (
                                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                ) : (
                                  <Send className="mr-1.5 size-3.5" />
                                )}
                                Resend
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3" align="end">
                              <div className="space-y-3">
                                <div className="text-xs text-muted-foreground">
                                  Last sent:{" "}
                                  {formatDateTime(voter.notificationLastSentAt)}
                                </div>
                                <div className="space-y-2">
                                  <button
                                    className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    disabled={
                                      !voter.phoneNumber ||
                                      (isResending &&
                                        pendingResendSessionId ===
                                          voter.sessionId)
                                    }
                                    onClick={() => {
                                      handleResendSessionNotification(
                                        voter.sessionId,
                                      );
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isResending &&
                                      pendingResendSessionId ===
                                        voter.sessionId ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <MessageSquare className="size-4" />
                                      )}
                                      <span className="text-sm font-medium">
                                        Send by SMS
                                      </span>
                                    </div>
                                  </button>
                                  <button
                                    className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    disabled={!voter.email}
                                    onClick={() => {
                                      handleResendSessionNotification(
                                        voter.sessionId,
                                      );
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Mail className="size-4" />
                                      <span className="text-sm font-medium">
                                        Send by Email
                                      </span>
                                    </div>
                                  </button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={
                                  isClearingVote ||
                                  isDeletingSession ||
                                  pendingClearVoteSessionId ===
                                    voter.sessionId ||
                                  pendingDeleteSessionId === voter.sessionId
                                }
                              >
                                {pendingClearVoteSessionId ===
                                  voter.sessionId ||
                                pendingDeleteSessionId === voter.sessionId ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <MoreVertical className="size-3.5" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleClearVote(voter.sessionId)}
                                disabled={
                                  !voter.voteSubmission ||
                                  isClearingVote ||
                                  isDeletingSession ||
                                  pendingClearVoteSessionId ===
                                    voter.sessionId ||
                                  pendingDeleteSessionId === voter.sessionId
                                }
                              >
                                <X className="size-4" />
                                Clear vote
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() =>
                                  handleDeleteSession(voter.sessionId)
                                }
                                disabled={
                                  isClearingVote ||
                                  isDeletingSession ||
                                  pendingClearVoteSessionId ===
                                    voter.sessionId ||
                                  pendingDeleteSessionId === voter.sessionId
                                }
                              >
                                <Trash2 className="size-4" />
                                Delete session
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No voting sessions found for this topic.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {voters.length} of {total} voters
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVotersPage(Math.max(1, votersPage - 1))}
              disabled={votersPage <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pageCount === 0 ? 0 : votersPage} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setVotersPage(
                  pageCount > 0
                    ? Math.min(pageCount, votersPage + 1)
                    : votersPage + 1,
                )
              }
              disabled={pageCount === 0 || votersPage >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
