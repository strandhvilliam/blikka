"use client"

import type { Topic } from "@blikka/db"
import {
  AlarmClockCheck,
  CheckCircle2,
  Clock3,
  Lock,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  TagIcon,
  TimerOff,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ByCameraSubmissionWindowState } from "@/lib/by-camera/by-camera-submission-window-state"
import { formatTimestamp } from "../_lib/formatting"

type ActiveTopicBannerProps = {
  activeTopic: Topic | null
  submissionState: ByCameraSubmissionWindowState
  submissionCount: number
  onEdit: (topic: Topic) => void
  onEditSubmissionWindow: (topic: Topic) => void
  onCreate: () => void
  isLoading: boolean
}

const BADGE_STYLES: Record<
  Exclude<ByCameraSubmissionWindowState, "no-active-topic">,
  {
    label: string
    className: string
    icon: typeof Clock3
  }
> = {
  "not-opened": {
    label: "Awaiting submission start",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200",
    icon: Play,
  },
  scheduled: {
    label: "Scheduled to open",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
    icon: Clock3,
  },
  open: {
    label: "Open for submissions",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    icon: CheckCircle2,
  },
  closed: {
    label: "Submission window ended",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
    icon: TimerOff,
  },
}

export function ActiveTopicBanner({
  activeTopic,
  submissionState,
  submissionCount,
  onEdit,
  onEditSubmissionWindow,
  onCreate,
  isLoading,
}: ActiveTopicBannerProps) {
  if (activeTopic) {
    const resolvedSubmissionState =
      submissionState === "no-active-topic" ? "not-opened" : submissionState
    const badge = BADGE_STYLES[resolvedSubmissionState]
    const BadgeIcon = badge.icon
    const submissionWindowLockedAfterVote =
      resolvedSubmissionState === "closed" &&
      Boolean(activeTopic.votingStartsAt)
    const submissionWindowActionLabel =
      resolvedSubmissionState === "not-opened"
        ? "Start submissions"
        : resolvedSubmissionState === "closed"
          ? submissionWindowLockedAfterVote
            ? "Submission window closed"
            : "Reopen submissions"
          : "Edit submission window"

    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-border p-5 shadow-sm sm:p-6"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklch, var(--brand-primary) 6%, var(--card)) 0%, var(--card) 60%)",
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10">
              <Zap className="size-5 text-brand-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
                  {activeTopic.name}
                </h3>
                <Badge
                  className={`h-5 shrink-0 gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}
                >
                  <BadgeIcon className="size-3" />
                  {badge.label}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Active since {formatTimestamp(activeTopic.activatedAt ?? activeTopic.createdAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
                  Starts:{" "}
                  <span className="font-medium text-foreground">
                    {activeTopic.scheduledStart
                      ? formatTimestamp(activeTopic.scheduledStart)
                      : "Not set"}
                  </span>
                </div>
                <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
                  Ends:{" "}
                  <span className="font-medium text-foreground">
                    {activeTopic.scheduledEnd
                      ? formatTimestamp(activeTopic.scheduledEnd)
                      : "No end time"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-col items-end">
              <p className="text-2xl font-semibold tabular-nums leading-none text-foreground">
                {submissionCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">submissions</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                size="sm"
                onClick={() => onEditSubmissionWindow(activeTopic)}
                disabled={isLoading}
                className="gap-1.5"
              >
                {resolvedSubmissionState === "not-opened" ? (
                  <Play className="size-3" />
                ) : resolvedSubmissionState === "closed" ? (
                  submissionWindowLockedAfterVote ? (
                    <Lock className="size-3" />
                  ) : (
                    <RotateCcw className="size-3" />
                  )
                ) : (
                  <AlarmClockCheck className="size-3" />
                )}
                {submissionWindowActionLabel}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(activeTopic)}
                disabled={isLoading}
                className="gap-1.5"
              >
                <Pencil className="size-3" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-muted/20 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <TagIcon className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">No active topic</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Step 1: activate a topic below. Step 2: start submissions from the active topic panel.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onCreate} className="gap-1.5">
          <Plus className="size-3.5" />
          Create topic
        </Button>
      </div>
    </div>
  )
}
