"use client"

import type { Topic } from "@blikka/db"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ImageIcon,
  Loader2,
  Play,
  TimerOff,
  Users,
  Vote,
} from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { Button } from "@/components/ui/button"
import {
  getSubmissionLifecycleState,
  getVotingLifecycleState,
} from "@/lib/voting/voting-lifecycle"
import {
  formatDateTime,
  toDateTimeLocalValue,
  toIsoFromLocal,
} from "../_lib/utils"

interface VotingSetupProps {
  activeTopic: Topic
}

const SUBMISSION_STATE_STYLES = {
  open: "border-blue-200 bg-blue-50 text-blue-700",
  ended: "border-emerald-200 bg-emerald-50 text-emerald-700",
} as const

const VOTING_STATE_STYLES = {
  "not-started": "border-slate-200 bg-slate-100 text-slate-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ended: "border-amber-200 bg-amber-50 text-amber-700",
} as const

function StatusPill({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  )
}

export function VotingSetup({
  activeTopic,
}: VotingSetupProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()

  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  )

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
    ])
  }

  const endSubmissionsMutation = useMutation(
    trpc.topics.update.mutationOptions({
      onSuccess: async () => {
        toast.success("Submissions ended")
        await invalidateVotingData()
      },
      onError: (error) => {
        toast.error(error.message || "Failed to end submissions")
      },
    }),
  )

  const startVotingMutation = useMutation(
    trpc.voting.startVotingSessions.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting started")
        await invalidateVotingData()
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start voting")
      },
    }),
  )

  const closeVotingMutation = useMutation(
    trpc.voting.closeTopicVotingWindow.mutationOptions({
      onSuccess: async () => {
        toast.success("Voting closed")
        await invalidateVotingData()
      },
      onError: (error) => {
        toast.error(error.message || "Failed to close voting")
      },
    }),
  )

  const [endsAtInput, setEndsAtInput] = useState(() => {
    const endsAt = summary.votingWindow.endsAt
    return endsAt ? toDateTimeLocalValue(new Date(endsAt)) : ""
  })

  const submissionState = getSubmissionLifecycleState(activeTopic.scheduledEnd)
  const votingState = getVotingLifecycleState(summary.votingWindow)
  const submissionCount = summary?.submissionStats.submissionCount ?? 0
  const participantWithSubmissionCount =
    summary?.submissionStats.participantWithSubmissionCount ?? 0
  const totalSessions = summary?.sessionStats.total ?? 0
  const plannedEndIso = endsAtInput ? toIsoFromLocal(endsAtInput) : null
  const hasValidPlannedEnd = !endsAtInput || !!plannedEndIso
  const hasScheduledVotingStart = !!summary.votingWindow.startsAt

  const startBlockedMessage = useMemo(() => {
    if (submissionState !== "ended") {
      return "Voting cannot start until the active topic submission window has ended."
    }
    if (submissionCount === 0) {
      return "This topic needs at least one submission before voting can start."
    }
    if (hasScheduledVotingStart) {
      return "Voting already has a recorded start timestamp for this topic."
    }
    if (!hasValidPlannedEnd) {
      return "Choose a valid planned end timestamp or leave it empty."
    }
    return null
  }, [
    hasScheduledVotingStart,
    hasValidPlannedEnd,
    submissionCount,
    submissionState,
  ])

  const canStartVoting = !startBlockedMessage && votingState === "not-started"

  const handleEndSubmissionsNow = () => {
    endSubmissionsMutation.mutate({
      domain,
      id: activeTopic.id,
      data: {
        scheduledEnd: new Date().toISOString(),
      },
    })
  }

  const handleStartVoting = () => {
    if (startBlockedMessage) {
      toast.error(startBlockedMessage)
      return
    }

    if (plannedEndIso && new Date(plannedEndIso).getTime() <= Date.now()) {
      toast.error("The planned voting end must be in the future.")
      return
    }

    startVotingMutation.mutate({
      domain,
      topicId: activeTopic.id,
      endsAt: plannedEndIso,
    })
  }

  const handleCloseVoting = () => {
    closeVotingMutation.mutate({
      domain,
      topicId: activeTopic.id,
    })
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="gap-1">
        <CardTitle className="font-gothic text-xl">
          Voting lifecycle
        </CardTitle>
        <CardDescription>
          End submissions, start voting when the topic is ready, and close
          voting directly from this page.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                Submission status
              </p>
              <StatusPill className={SUBMISSION_STATE_STYLES[submissionState]}>
                {submissionState === "ended" ? "Ended" : "Open"}
              </StatusPill>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              {submissionState === "ended"
                ? "Voting can start once the topic is ready."
                : "Voting remains blocked until submissions have ended."}
            </p>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Scheduled end</span>
                <span className="font-medium text-foreground">
                  {activeTopic.scheduledEnd
                    ? formatDateTime(activeTopic.scheduledEnd)
                    : "Not set"}
                </span>
              </div>
            </div>

            {submissionState === "open" ? (
              <Button
                className="mt-4 w-full"
                variant="outline"
                onClick={handleEndSubmissionsNow}
                disabled={endSubmissionsMutation.isPending}
              >
                {endSubmissionsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ending submissions...
                  </>
                ) : (
                  <>
                    <TimerOff className="mr-2 h-4 w-4" />
                    End submissions now
                  </>
                )}
              </Button>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                Voting status
              </p>
              <StatusPill className={VOTING_STATE_STYLES[votingState]}>
                {votingState === "not-started"
                  ? "Not started"
                  : votingState === "active"
                    ? "Active"
                    : "Ended"}
              </StatusPill>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Started</span>
                <span className="font-medium text-foreground">
                  {summary.votingWindow.startsAt
                    ? formatDateTime(summary.votingWindow.startsAt)
                    : "Not started"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Ends</span>
                <span className="font-medium text-foreground">
                  {summary.votingWindow.endsAt
                    ? formatDateTime(summary.votingWindow.endsAt)
                    : "No planned end"}
                </span>
              </div>
            </div>

            {votingState === "not-started" ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="planned-voting-end">
                    Optional voting end
                  </Label>
                  <Input
                    id="planned-voting-end"
                    type="datetime-local"
                    value={endsAtInput}
                    onChange={(event) => setEndsAtInput(event.target.value)}
                    placeholder="Leave empty"
                    disabled={hasScheduledVotingStart}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to keep voting open until you close it manually.
                  </p>
                </div>

                {startBlockedMessage ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {startBlockedMessage}
                  </div>
                ) : null}

                <Button
                  className="w-full"
                  onClick={handleStartVoting}
                  disabled={!canStartVoting || startVotingMutation.isPending}
                >
                  {startVotingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting voting...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start voting now
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            {votingState === "active" ? (
              <Button
                className="mt-4 w-full"
                variant="destructive"
                onClick={handleCloseVoting}
                disabled={closeVotingMutation.isPending}
              >
                {closeVotingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Closing voting...
                  </>
                ) : (
                  <>
                    <TimerOff className="mr-2 h-4 w-4" />
                    Close voting now
                  </>
                )}
              </Button>
            ) : null}

            {votingState === "ended" ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Voting has ended for this topic. Results and completed votes
                remain available below.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm font-medium text-foreground">
              Session readiness
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  <p className="text-sm">Submissions in topic</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {submissionCount}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <p className="text-sm">Eligible participants</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {participantWithSubmissionCount}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Vote className="h-4 w-4" />
                  <p className="text-sm">Current sessions</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {totalSessions}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Missing participant sessions will be created when voting
                  starts.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">
                Topic submissions ended
              </span>
              {submissionState === "ended" ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Pending
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">
                Topic has submissions
              </span>
              {submissionCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Missing
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">
                Voting session lifecycle
              </span>
              {votingState === "active" ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <Clock3 className="h-3.5 w-3.5" />
                  Running
                </span>
              ) : votingState === "ended" ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <TimerOff className="h-3.5 w-3.5" />
                  Closed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                  <Clock3 className="h-3.5 w-3.5" />
                  Awaiting start
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
