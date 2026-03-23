"use client";

import type { Topic } from "@blikka/db";
import { useMemo, useState } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Clock,
  Flag,
  ImageIcon,
  Loader2,
  Lock,
  Play,
  RotateCcw,
  Send,
  Users,
  Vote,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  getSubmissionLifecycleState,
  getVotingLifecycleState,
} from "@/lib/voting-lifecycle";
import {
  formatDateTime,
  toDateTimeLocalValue,
  toIsoFromLocal,
} from "../_lib/utils";

interface VotingSetupProps {
  activeTopic: Topic;
}

type LifecyclePhase =
  | "waiting"
  | "end-submissions"
  | "start-voting"
  | "close-voting"
  | "complete";

function getLifecyclePhase(
  submissionState: "not-started" | "open" | "ended",
  votingState: "not-started" | "active" | "ended",
): LifecyclePhase {
  if (submissionState === "not-started") return "waiting";
  if (submissionState === "open") return "end-submissions";
  if (votingState === "not-started") return "start-voting";
  if (votingState === "active") return "close-voting";
  return "complete";
}

type StepStatus = "completed" | "active" | "upcoming";

function getCardStatus(stepNumber: number, phase: LifecyclePhase): StepStatus {
  const phaseToActiveStep: Record<LifecyclePhase, number> = {
    waiting: 1,
    "end-submissions": 2,
    "start-voting": 3,
    "close-voting": 4,
    complete: 5,
  };
  const activeStep = phaseToActiveStep[phase];
  if (stepNumber < activeStep) return "completed";
  if (stepNumber === activeStep) return "active";
  return "upcoming";
}

function StepCard({
  stepNumber,
  title,
  description,
  status,
  detail,
  extraContent,
  children,
}: {
  stepNumber: number;
  title: string;
  description: string;
  status: StepStatus;
  detail?: string | null;
  extraContent?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl p-6 transition-all duration-300",
        status === "completed" &&
          "border border-emerald-200/60 bg-emerald-50/30",
        status === "active" &&
          "border-2 border-brand-primary/25 bg-white shadow-sm",
        status === "upcoming" && "border border-border/40 bg-muted/20",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          status === "completed" && "bg-emerald-500 text-white",
          status === "active" &&
            "border-2 border-brand-primary bg-brand-primary/5 text-brand-primary",
          status === "upcoming" &&
            "border-2 border-border bg-muted/40 text-muted-foreground/40",
        )}
      >
        {status === "completed" ? (
          <Check className="h-4.5 w-4.5" strokeWidth={2.5} />
        ) : (
          String(stepNumber).padStart(2, "0")
        )}
      </div>

      <div className="mt-5">
        <h3
          className={cn(
            "text-[15px] font-semibold tracking-tight",
            status === "completed" && "text-emerald-900",
            status === "active" && "text-foreground",
            status === "upcoming" && "text-muted-foreground/40",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "mt-1.5 text-[13px] leading-relaxed",
            status === "completed" && "text-emerald-700/60",
            status === "active" && "text-muted-foreground",
            status === "upcoming" && "text-muted-foreground/30",
          )}
        >
          {description}
        </p>
        {detail && (
          <p
            className={cn(
              "mt-2.5 text-xs",
              status === "completed" && "text-emerald-600/60",
              status === "active" && "text-muted-foreground/70",
            )}
          >
            {detail}
          </p>
        )}
      </div>

      {extraContent && <div className="mt-2">{extraContent}</div>}

      <div className="mt-auto pt-3">{children}</div>
    </div>
  );
}

export function VotingSetup({ activeTopic }: VotingSetupProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const domain = useDomain();

  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  );

  const invalidateVotingData = async () => {
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
        queryKey: trpc.voting.getParticipantsWithoutVotingSession.pathKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.marathons.pathKey(),
      }),
    ]);
  };

  const startSubmissionsMutation = useMutation(
    trpc.topics.update.mutationOptions({
      onSuccess: async () => {
        toast.success("Submissions opened");
        await invalidateVotingData();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to open submissions");
      },
    }),
  );

  const endSubmissionsMutation = useMutation(
    trpc.topics.update.mutationOptions({
      onSuccess: async () => {
        toast.success("Submissions closed");
        await invalidateVotingData();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to close submissions");
      },
    }),
  );

  const startVotingMutation = useMutation(
    trpc.voting.startVotingSessions.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting started");
        await invalidateVotingData();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start voting");
      },
    }),
  );

  const closeVotingMutation = useMutation(
    trpc.voting.closeTopicVotingWindow.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting finished");
        await invalidateVotingData();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to finish voting");
      },
    }),
  );

  const reopenVotingMutation = useMutation(
    trpc.voting.reopenTopicVotingWindow.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting reopened");
        await invalidateVotingData();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to reopen voting");
      },
    }),
  );

  const startTiebreakRoundMutation = useMutation(
    trpc.voting.startTiebreakRound.mutationOptions({
      onSuccess: async () => {
        toast.success("Tie-break voting started");
        await invalidateVotingData();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start tie-break voting");
      },
    }),
  );

  const [endsAtInput, setEndsAtInput] = useState(() => {
    const endsAt = summary.votingWindow.endsAt;
    return endsAt ? toDateTimeLocalValue(new Date(endsAt)) : "";
  });
  const [isStartVotingDialogOpen, setIsStartVotingDialogOpen] = useState(false);
  const [sendInitialSms, setSendInitialSms] = useState(true);
  const [isCloseVotingDialogOpen, setIsCloseVotingDialogOpen] = useState(false);
  const [isReopenVotingDialogOpen, setIsReopenVotingDialogOpen] =
    useState(false);
  const [isStartTiebreakDialogOpen, setIsStartTiebreakDialogOpen] =
    useState(false);

  const submissionState = getSubmissionLifecycleState(
    activeTopic.scheduledStart,
    activeTopic.scheduledEnd,
  );
  const votingState = getVotingLifecycleState(summary.votingWindow);
  const currentPhase = getLifecyclePhase(submissionState, votingState);
  const submissionCount = summary?.submissionStats.submissionCount ?? 0;
  const participantWithSubmissionCount =
    summary?.submissionStats.participantWithSubmissionCount ?? 0;
  const totalSessions = summary?.sessionStats.total ?? 0;
  const plannedEndIso = endsAtInput ? toIsoFromLocal(endsAtInput) : null;
  const hasValidPlannedEnd = !endsAtInput || !!plannedEndIso;
  const hasScheduledVotingStart = !!summary.votingWindow.startsAt;

  const startBlockedMessage = useMemo(() => {
    if (submissionState !== "ended") {
      return "Voting cannot start until submissions have ended.";
    }
    if (submissionCount === 0) {
      return "At least one submission is needed before voting can start.";
    }
    if (hasScheduledVotingStart) {
      return "Voting already has a recorded start timestamp.";
    }
    if (!hasValidPlannedEnd) {
      return "Choose a valid end time or leave it empty.";
    }
    return null;
  }, [
    hasScheduledVotingStart,
    hasValidPlannedEnd,
    submissionCount,
    submissionState,
  ]);

  const canStartVoting = !startBlockedMessage && votingState === "not-started";

  const handleStartSubmissionsNow = () => {
    startSubmissionsMutation.mutate({
      domain,
      id: activeTopic.id,
      data: { scheduledStart: new Date().toISOString() },
    });
  };

  const handleEndSubmissionsNow = () => {
    endSubmissionsMutation.mutate({
      domain,
      id: activeTopic.id,
      data: { scheduledEnd: new Date().toISOString() },
    });
  };

  const handleStartVotingClick = () => {
    if (startBlockedMessage) {
      toast.error(startBlockedMessage);
      return;
    }
    if (plannedEndIso && new Date(plannedEndIso).getTime() <= Date.now()) {
      toast.error("The planned voting end must be in the future.");
      return;
    }
    setIsStartVotingDialogOpen(true);
  };

  const handleConfirmStartVoting = () => {
    startVotingMutation.mutate(
      {
        domain,
        topicId: activeTopic.id,
        endsAt: plannedEndIso,
        sendInitialSms,
      },
      { onSuccess: () => handleStartVotingDialogOpenChange(false) },
    );
  };

  const handleStartVotingDialogOpenChange = (open: boolean) => {
    setIsStartVotingDialogOpen(open);
    if (!open) {
      setSendInitialSms(true);
    }
  };

  const handleCloseVotingClick = () => setIsCloseVotingDialogOpen(true);

  const handleConfirmCloseVoting = () => {
    closeVotingMutation.mutate(
      { domain, topicId: activeTopic.id },
      { onSuccess: () => setIsCloseVotingDialogOpen(false) },
    );
  };

  const handleReopenVotingClick = () => setIsReopenVotingDialogOpen(true);

  const handleConfirmReopenVoting = () => {
    reopenVotingMutation.mutate(
      { domain, topicId: activeTopic.id },
      { onSuccess: () => setIsReopenVotingDialogOpen(false) },
    );
  };

  const handleStartTiebreakClick = () => setIsStartTiebreakDialogOpen(true);

  const handleConfirmStartTiebreak = () => {
    startTiebreakRoundMutation.mutate(
      { domain, topicId: activeTopic.id, endsAt: null },
      { onSuccess: () => setIsStartTiebreakDialogOpen(false) },
    );
  };

  const step1Status = getCardStatus(1, currentPhase);
  const step2Status = getCardStatus(2, currentPhase);
  const step3Status = getCardStatus(3, currentPhase);
  const step4Status = getCardStatus(4, currentPhase);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Step 1: Open Submissions */}
        <StepCard
          stepNumber={1}
          title="Open Submissions"
          description="Let your participants upload their photo submissions."
          status={step1Status}
          detail={
            step1Status === "active" && activeTopic.scheduledStart
              ? `Scheduled: ${formatDateTime(activeTopic.scheduledStart)}`
              : step1Status === "completed" && activeTopic.scheduledStart
                ? `Opened ${formatDateTime(activeTopic.scheduledStart)}`
                : null
          }
        >
          {step1Status === "active" ? (
            <PrimaryButton
              onClick={handleStartSubmissionsNow}
              disabled={startSubmissionsMutation.isPending}
              className="w-full"
            >
              {startSubmissionsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Open
                </>
              )}
            </PrimaryButton>
          ) : step1Status === "completed" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Completed
            </span>
          ) : (
            <Button disabled variant="outline" className="w-full">
              <Play className="h-4 w-4" />
              Open
            </Button>
          )}
        </StepCard>

        {/* Step 2: Close Submissions */}
        <StepCard
          stepNumber={2}
          title="Close Submissions"
          description="End the upload window so voting can begin."
          status={step2Status}
          detail={
            step2Status === "active" && activeTopic.scheduledEnd
              ? `Scheduled end: ${formatDateTime(activeTopic.scheduledEnd)}`
              : step2Status === "completed" && activeTopic.scheduledEnd
                ? `Closed ${formatDateTime(activeTopic.scheduledEnd)}`
                : null
          }
        >
          {step2Status === "active" ? (
            <PrimaryButton
              onClick={handleEndSubmissionsNow}
              disabled={endSubmissionsMutation.isPending}
              className="w-full"
            >
              {endSubmissionsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Closing…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Close
                </>
              )}
            </PrimaryButton>
          ) : step2Status === "completed" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Completed
            </span>
          ) : (
            <Button disabled variant="outline" className="w-full">
              <Lock className="h-4 w-4" />
              Close
            </Button>
          )}
        </StepCard>

        {/* Step 3: Start Voting */}
        <StepCard
          stepNumber={3}
          title="Start Voting"
          description="Open voting and optionally send an SMS with a voting link."
          status={step3Status}
          detail={
            step3Status === "completed" && summary.votingWindow.startsAt
              ? `Started ${formatDateTime(summary.votingWindow.startsAt)}`
              : null
          }
          extraContent={
            step3Status === "active" ? (
              <div className="space-y-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={hasScheduledVotingStart}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    >
                      <Clock className="h-3 w-3" />
                      {endsAtInput
                        ? formatDateTime(toIsoFromLocal(endsAtInput))
                        : "Set Voing End Time"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 space-y-3">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="planned-voting-end"
                        className="text-[12px] font-medium text-foreground"
                      >
                        Voting end time
                      </Label>
                      <Input
                        id="planned-voting-end"
                        type="datetime-local"
                        value={endsAtInput}
                        onChange={(event) => setEndsAtInput(event.target.value)}
                        disabled={hasScheduledVotingStart}
                        className="h-8 text-[13px]"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">
                      Optional. Leave empty to close manually.
                    </p>
                  </PopoverContent>
                </Popover>

                {startBlockedMessage && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    {startBlockedMessage}
                  </div>
                )}
              </div>
            ) : null
          }
        >
          {step3Status === "active" ? (
            <PrimaryButton
              onClick={handleStartVotingClick}
              disabled={!canStartVoting || startVotingMutation.isPending}
              className="w-full"
            >
              {startVotingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Start
                </>
              )}
            </PrimaryButton>
          ) : step3Status === "completed" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Completed
            </span>
          ) : (
            <Button disabled variant="outline" className="w-full">
              <Send className="h-4 w-4" />
              Start
            </Button>
          )}
        </StepCard>

        {/* Step 4: Finish Voting */}
        <StepCard
          stepNumber={4}
          title="Finish Voting"
          description="Close the voting window and reveal the leaderboard."
          status={step4Status}
          detail={
            step4Status === "active"
              ? [
                  summary.votingWindow.startsAt &&
                    `Started ${formatDateTime(summary.votingWindow.startsAt)}`,
                  summary.votingWindow.endsAt &&
                    `Ends ${formatDateTime(summary.votingWindow.endsAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || null
              : step4Status === "completed" && summary.votingWindow.endsAt
                ? `Ended ${formatDateTime(summary.votingWindow.endsAt)}`
                : null
          }
        >
          {step4Status === "active" ? (
            <PrimaryButton
              onClick={handleCloseVotingClick}
              disabled={closeVotingMutation.isPending}
              className="w-full"
            >
              {closeVotingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finishing…
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4" />
                  Finish
                </>
              )}
            </PrimaryButton>
          ) : step4Status === "completed" && currentPhase === "complete" ? (
            <div className="flex flex-col gap-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                Completed
              </span>
              {summary.canStartTiebreak ? (
                <PrimaryButton
                  onClick={handleStartTiebreakClick}
                  disabled={startTiebreakRoundMutation.isPending}
                  className="w-full"
                >
                  {startTiebreakRoundMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    <>
                      <Vote className="h-4 w-4" />
                      Start tie-break
                    </>
                  )}
                </PrimaryButton>
              ) : null}
              <button
                type="button"
                onClick={handleReopenVotingClick}
                disabled={reopenVotingMutation.isPending}
                className="flex w-fit items-center gap-1 self-start text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {reopenVotingMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                Reopen round
              </button>
            </div>
          ) : (
            <Button disabled variant="outline" className="w-full">
              <Flag className="h-4 w-4" />
              Finish
            </Button>
          )}
        </StepCard>
      </div>

      {/* Stats */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="font-semibold tabular-nums text-foreground">
            {submissionCount}
          </span>{" "}
          submissions
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span className="font-semibold tabular-nums text-foreground">
            {participantWithSubmissionCount}
          </span>{" "}
          participants
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Vote className="h-3.5 w-3.5" />
          <span className="font-semibold tabular-nums text-foreground">
            {totalSessions}
          </span>{" "}
          voting sessions
        </span>
      </div>

      {/* Confirmation dialogs */}
      <AlertDialog
        open={isStartVotingDialogOpen}
        onOpenChange={handleStartVotingDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start voting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will open the voting window and create voting sessions for
              all {participantWithSubmissionCount} participants with submissions.
              Initial SMS invites are only sent if you keep the box checked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <Checkbox
              id="send-initial-voting-sms"
              checked={sendInitialSms}
              onCheckedChange={(checked) => setSendInitialSms(checked === true)}
              disabled={startVotingMutation.isPending}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label
                htmlFor="send-initial-voting-sms"
                className="text-sm font-medium leading-none"
              >
                Send initial SMS invites
              </Label>
              <p className="text-sm text-muted-foreground">
                Send a voting link to participants who have a phone number on
                file.
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={startVotingMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmStartVoting();
              }}
              disabled={startVotingMutation.isPending}
            >
              {startVotingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                "Start voting"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isCloseVotingDialogOpen}
        onOpenChange={setIsCloseVotingDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish voting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will close the voting window. Participants will no longer be
              able to submit votes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closeVotingMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCloseVoting();
              }}
              disabled={closeVotingMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {closeVotingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finishing…
                </>
              ) : (
                "Finish voting"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isReopenVotingDialogOpen}
        onOpenChange={setIsReopenVotingDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen voting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reopen the voting window. Participants will be able to
              submit votes again. Votes already cast will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopenVotingMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmReopenVoting();
              }}
              disabled={reopenVotingMutation.isPending}
            >
              {reopenVotingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reopening…
                </>
              ) : (
                "Reopen voting"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isStartTiebreakDialogOpen}
        onOpenChange={setIsStartTiebreakDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start tie-break round?</AlertDialogTitle>
            <AlertDialogDescription>
              This will start a new voting round using the same voter links. No
              SMS will be sent. Only the tied leading submissions will be shown,
              and all existing voting sessions can vote again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={startTiebreakRoundMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmStartTiebreak();
              }}
              disabled={startTiebreakRoundMutation.isPending}
            >
              {startTiebreakRoundMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                "Start tie-break"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
