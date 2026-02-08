"use client";

import { useMemo, useState } from "react";
import { addHours, format } from "date-fns";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock3,
  Copy,
  Loader2,
  Medal,
  Trophy,
  UserPlus,
  Vote,
} from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function toDateTimeLocalValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoFromLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "MMM d, yyyy HH:mm");
}

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
    marathon.topics.find((topic) => topic.orderIndex === 0) ?? null;
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

  const [startsAtInput, setStartsAtInput] = useState(() =>
    toDateTimeLocalValue(new Date()),
  );
  const [endsAtInput, setEndsAtInput] = useState(() =>
    toDateTimeLocalValue(addHours(new Date(), 24)),
  );

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStartsAtInput, setInviteStartsAtInput] = useState(() =>
    toDateTimeLocalValue(new Date()),
  );
  const [inviteEndsAtInput, setInviteEndsAtInput] = useState(() =>
    toDateTimeLocalValue(addHours(new Date(), 24)),
  );

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

  const hasSessions = (overview?.sessionStats.total ?? 0) > 0;

  const topRankMap = useMemo(() => {
    return new Map(
      overview?.topRanks.map((rank) => [rank.rank, rank.entries]) ?? [],
    );
  }, [overview?.topRanks]);

  const handleStartVoting = () => {
    if (!activeTopic) {
      toast.error("No active by-camera topic found");
      return;
    }

    const startsAtIso = toIsoFromLocal(startsAtInput);
    const endsAtIso = toIsoFromLocal(endsAtInput);

    if (!startsAtIso || !endsAtIso) {
      toast.error("Please provide valid start and end timestamps");
      return;
    }

    startVotingMutation.mutate({
      domain,
      topicId: activeTopic.id,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
    });
  };

  const handleOpenInviteDialog = () => {
    setCreatedInviteUrl(null);
    setInviteFirstName("");
    setInviteLastName("");
    setInviteEmail("");

    const startsAt = overview?.votingWindow.startsAt
      ? toDateTimeLocalValue(new Date(overview.votingWindow.startsAt))
      : toDateTimeLocalValue(new Date());
    const endsAt = overview?.votingWindow.endsAt
      ? toDateTimeLocalValue(new Date(overview.votingWindow.endsAt))
      : toDateTimeLocalValue(addHours(new Date(), 24));

    setInviteStartsAtInput(startsAt);
    setInviteEndsAtInput(endsAt);
    setIsInviteDialogOpen(true);
  };

  const handleCreateManualInvite = () => {
    if (!activeTopic) {
      toast.error("No active by-camera topic found");
      return;
    }

    const startsAtIso = toIsoFromLocal(inviteStartsAtInput);
    const endsAtIso = toIsoFromLocal(inviteEndsAtInput);

    if (!startsAtIso || !endsAtIso) {
      toast.error("Please provide valid start and end timestamps");
      return;
    }

    createManualVotingMutation.mutate({
      domain,
      topicId: activeTopic.id,
      firstName: inviteFirstName,
      lastName: inviteLastName,
      email: inviteEmail,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
    });
  };

  const handleCopyInviteLink = async () => {
    if (!createdInviteUrl) return;
    await navigator.clipboard.writeText(createdInviteUrl);
    toast.success("Invite link copied to clipboard");
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">
              Voting
            </h1>
            <Badge variant="secondary" className="gap-1">
              <Vote className="h-3 w-3" />
              Topic {activeTopic.orderIndex + 1}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Manage voting sessions and monitor current rankings for{" "}
            <strong>{activeTopic.name}</strong>.
          </p>
        </div>

        {!isOverviewLoading && hasSessions ? (
          <Button variant="outline" onClick={handleOpenInviteDialog}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Manual Voter
          </Button>
        ) : null}
      </div>

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
        <Card>
          <CardContent className="py-8 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading voting overview...
          </CardContent>
        </Card>
      ) : null}

      {!isOverviewLoading && !isOverviewError && !!overview && !hasSessions ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-rocgrotesk">
              Start voting session
            </CardTitle>
            <CardDescription>
              Voting sessions will be created for all participants with a
              submission on this topic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="voting-start-at">Start timestamp</Label>
                <Input
                  id="voting-start-at"
                  type="datetime-local"
                  value={startsAtInput}
                  onChange={(event) => setStartsAtInput(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voting-end-at">End timestamp</Label>
                <Input
                  id="voting-end-at"
                  type="datetime-local"
                  value={endsAtInput}
                  onChange={(event) => setEndsAtInput(event.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleStartVoting}
              disabled={startVotingMutation.isPending}
            >
              {startVotingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting voting...
                </>
              ) : (
                <>
                  <Vote className="h-4 w-4 mr-2" />
                  Start Voting Sessions
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isOverviewLoading && !isOverviewError && !!overview && hasSessions ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview?.sessionStats.total ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overview?.sessionStats.completed ?? 0} voted,{" "}
                  {overview?.sessionStats.pending ?? 0} pending
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Voting Window
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  <Clock3 className="h-3 w-3 inline mr-1" />
                  {formatDateTime(overview?.votingWindow.startsAt)} -{" "}
                  {formatDateTime(overview?.votingWindow.endsAt)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Votes Cast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview?.voteStats.totalVotes ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total completed votes
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-rocgrotesk">Leaderboard</CardTitle>
              <CardDescription>
                Top placements with tie-aware ranking based on total votes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[1, 2, 3].map((rank) => {
                const entries = topRankMap.get(rank) ?? [];
                const tone =
                  rank === 1
                    ? "text-amber-600"
                    : rank === 2
                      ? "text-slate-600"
                      : "text-orange-600";

                return (
                  <div
                    key={rank}
                    className="rounded-xl border bg-muted/30 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        Place {rank}
                      </span>
                      <Medal className={`h-4 w-4 ${tone}`} />
                    </div>

                    {entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No submission yet
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {entries.map((entry) => (
                          <div key={entry.submissionId} className="text-sm">
                            <p className="font-medium">
                              {entry.participantFirstName}{" "}
                              {entry.participantLastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Submission #{entry.submissionId} -{" "}
                              {entry.voteCount} votes
                            </p>
                          </div>
                        ))}
                        {entries.length > 1 ? (
                          <Badge variant="outline" className="mt-1">
                            Tie ({entries.length} submissions)
                          </Badge>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-rocgrotesk">
                All Ranked Submissions
              </CardTitle>
              <CardDescription>
                Ordered by vote count descending, then upload time, then
                submission id.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Submission</TableHead>
                      <TableHead>Participant</TableHead>
                      <TableHead>Votes</TableHead>
                      <TableHead>Tie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview?.leaderboard.length ? (
                      overview.leaderboard.map((entry) => (
                        <TableRow key={entry.submissionId}>
                          <TableCell className="font-medium">
                            #{entry.rank}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-medium">
                                Submission #{entry.submissionId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Uploaded{" "}
                                {formatDateTime(entry.submissionCreatedAt)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {entry.participantFirstName}{" "}
                            {entry.participantLastName}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {entry.voteCount}
                          </TableCell>
                          <TableCell>
                            {entry.isTie ? (
                              <Badge variant="outline">
                                Tie ({entry.tieSize})
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                -
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No submissions found for this topic.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create manual voting invite</DialogTitle>
            <DialogDescription>
              Create a voting session for a non-participant voter and copy the
              generated link.
            </DialogDescription>
          </DialogHeader>

          {createdInviteUrl ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="created-vote-link">Invite link</Label>
                <div className="flex gap-2">
                  <Input
                    id="created-vote-link"
                    value={createdInviteUrl}
                    readOnly
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyInviteLink}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreatedInviteUrl(null);
                    setInviteFirstName("");
                    setInviteLastName("");
                    setInviteEmail("");
                  }}
                >
                  Create Another
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-first-name">First name</Label>
                  <Input
                    id="invite-first-name"
                    value={inviteFirstName}
                    onChange={(event) => setInviteFirstName(event.target.value)}
                    placeholder="Jane"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-last-name">Last name</Label>
                  <Input
                    id="invite-last-name"
                    value={inviteLastName}
                    onChange={(event) => setInviteLastName(event.target.value)}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="voter@example.com"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-start-at">Start timestamp</Label>
                  <Input
                    id="invite-start-at"
                    type="datetime-local"
                    value={inviteStartsAtInput}
                    onChange={(event) =>
                      setInviteStartsAtInput(event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-end-at">End timestamp</Label>
                  <Input
                    id="invite-end-at"
                    type="datetime-local"
                    value={inviteEndsAtInput}
                    onChange={(event) =>
                      setInviteEndsAtInput(event.target.value)
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  onClick={handleCreateManualInvite}
                  disabled={createManualVotingMutation.isPending}
                >
                  {createManualVotingMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating invite...
                    </>
                  ) : (
                    <>
                      <Trophy className="h-4 w-4 mr-2" />
                      Create Invite
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
