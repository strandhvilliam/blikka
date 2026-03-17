"use client"

import type { Topic } from "@blikka/db"
import { Fragment, useMemo, useState } from "react"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { AlertTriangle, Check, ImageIcon, Loader2, Play, TimerOff, Users, Vote } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { Button } from "@/components/ui/button"
import { getSubmissionLifecycleState, getVotingLifecycleState } from "@/lib/voting/voting-lifecycle"
import { formatDateTime, toDateTimeLocalValue, toIsoFromLocal } from "../_lib/utils"

interface VotingSetupProps {
  activeTopic: Topic
}

type LifecyclePhase =
  | "waiting"
  | "end-submissions"
  | "start-voting"
  | "close-voting"
  | "complete"

function getLifecyclePhase(
  submissionState: "not-started" | "open" | "ended",
  votingState: "not-started" | "active" | "ended",
): LifecyclePhase {
  if (submissionState === "not-started") return "waiting"
  if (submissionState === "open") return "end-submissions"
  if (votingState === "not-started") return "start-voting"
  if (votingState === "active") return "close-voting"
  return "complete"
}

const STEPS = [
  { id: "end-submissions", label: "End submissions" },
  { id: "start-voting", label: "Start voting" },
  { id: "close-voting", label: "Close voting" },
] as const

type StepStatus = "completed" | "current" | "upcoming"

function getStepStatus(stepId: string, currentPhase: LifecyclePhase): StepStatus {
  const order = ["end-submissions", "start-voting", "close-voting"]
  const phaseIdx = order.indexOf(currentPhase)
  const currentIdx =
    currentPhase === "complete" ? 3 : currentPhase === "waiting" ? -1 : phaseIdx
  const stepIdx = order.indexOf(stepId)
  if (stepIdx < currentIdx) return "completed"
  if (stepIdx === currentIdx) return "current"
  return "upcoming"
}

function StepIndicator({ currentPhase }: { currentPhase: LifecyclePhase }) {
  return (
    <div className="flex items-center justify-center px-6 py-4">
      {STEPS.map((step, i) => {
        const status = getStepStatus(step.id, currentPhase)
        return (
          <Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  status === "completed" && "bg-emerald-500 text-white",
                  status === "current" &&
                    "bg-[#FF5D4B] text-white ring-2 ring-[#FF5D4B]/25 ring-offset-1",
                  status === "upcoming" && "bg-slate-200 text-slate-400",
                )}
              >
                {status === "completed" ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-[13px] font-medium sm:inline",
                  status === "completed" && "text-emerald-700",
                  status === "current" && "text-slate-900",
                  status === "upcoming" && "text-slate-400",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-px w-8 sm:mx-4 sm:w-14",
                  status === "completed" ? "bg-emerald-300" : "bg-slate-200",
                )}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

export function VotingSetup({ activeTopic }: VotingSetupProps) {
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

  const startSubmissionsMutation = useMutation(
    trpc.topics.update.mutationOptions({
      onSuccess: async () => {
        toast.success("Submissions started")
        await invalidateVotingData()
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start submissions")
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

  const submissionState = getSubmissionLifecycleState(activeTopic.scheduledStart, activeTopic.scheduledEnd)
  const votingState = getVotingLifecycleState(summary.votingWindow)
  const currentPhase = getLifecyclePhase(submissionState, votingState)
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
  }, [hasScheduledVotingStart, hasValidPlannedEnd, submissionCount, submissionState])

  const canStartVoting = !startBlockedMessage && votingState === "not-started"

  const handleStartSubmissionsNow = () => {
    startSubmissionsMutation.mutate({
      domain,
      id: activeTopic.id,
      data: {
        scheduledStart: new Date().toISOString(),
      },
    })
  }

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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <StepIndicator currentPhase={currentPhase} />

      <div className="border-t border-slate-100 px-6 py-5">
        {currentPhase === "waiting" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Waiting for submissions to begin
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                {activeTopic.scheduledStart
                  ? `Submissions scheduled to start ${formatDateTime(activeTopic.scheduledStart)}`
                  : "No submission start time has been scheduled yet."}
              </p>
            </div>
            <Button
              onClick={handleStartSubmissionsNow}
              disabled={startSubmissionsMutation.isPending}
              className="shrink-0"
            >
              {startSubmissionsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start submissions now
                </>
              )}
            </Button>
          </div>
        )}

        {currentPhase === "end-submissions" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Submissions are still open</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {activeTopic.scheduledEnd
                  ? `Scheduled to end ${formatDateTime(activeTopic.scheduledEnd)}`
                  : "No scheduled end time set"}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleEndSubmissionsNow}
              disabled={endSubmissionsMutation.isPending}
              className="shrink-0"
            >
              {endSubmissionsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ending...
                </>
              ) : (
                <>
                  <TimerOff className="mr-2 h-4 w-4" />
                  End submissions now
                </>
              )}
            </Button>
          </div>
        )}

        {currentPhase === "start-voting" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <Label
                  htmlFor="planned-voting-end"
                  className="text-[13px] font-medium text-slate-700"
                >
                  Voting end time <span className="font-normal text-slate-400">(optional)</span>
                </Label>
                <Input
                  id="planned-voting-end"
                  type="datetime-local"
                  value={endsAtInput}
                  onChange={(event) => setEndsAtInput(event.target.value)}
                  disabled={hasScheduledVotingStart}
                  className="max-w-64"
                />
                <p className="text-xs text-slate-400">Leave empty to close voting manually.</p>
              </div>
              <Button
                onClick={handleStartVoting}
                disabled={!canStartVoting || startVotingMutation.isPending}
                className="shrink-0"
              >
                {startVotingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start voting
                  </>
                )}
              </Button>
            </div>

            {startBlockedMessage && (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                {startBlockedMessage}
              </div>
            )}
          </div>
        )}

        {currentPhase === "close-voting" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Voting is live</p>
              <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-500">
                <span>Started {formatDateTime(summary.votingWindow.startsAt)}</span>
                {summary.votingWindow.endsAt && (
                  <span>Ends {formatDateTime(summary.votingWindow.endsAt)}</span>
                )}
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={handleCloseVoting}
              disabled={closeVotingMutation.isPending}
              className="shrink-0"
            >
              {closeVotingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                <>
                  <TimerOff className="mr-2 h-4 w-4" />
                  Close voting
                </>
              )}
            </Button>
          </div>
        )}

        {currentPhase === "complete" && (
          <div>
            <p className="text-sm font-semibold text-slate-900">Voting complete</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Results and completed votes are available in the tabs below.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 px-6 py-3">
        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
          <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">{submissionCount}</span> submissions
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">
            {participantWithSubmissionCount}
          </span>{" "}
          participants
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
          <Vote className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">{totalSessions}</span> sessions
        </span>
      </div>
    </div>
  )
}
