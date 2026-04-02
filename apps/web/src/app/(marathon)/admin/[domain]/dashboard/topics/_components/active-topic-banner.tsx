"use client"

import type { Topic } from "@blikka/db"
import {
  CheckCircle2,
  Clock3,
  Lock,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Square,
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
  votingHasStarted: boolean
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
    label: "Waiting to open",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: Play,
  },
  scheduled: {
    label: "Scheduled to open",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Clock3,
  },
  open: {
    label: "Open for submissions",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  closed: {
    label: "Submissions closed",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: TimerOff,
  },
}

export function ActiveTopicBanner({
  activeTopic,
  submissionState,
  votingHasStarted,
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
    const submissionWindowLockedAfterVote = resolvedSubmissionState === "closed" && votingHasStarted
    const submissionWindowActionLabel =
      resolvedSubmissionState === "not-opened"
        ? "Open submissions"
        : resolvedSubmissionState === "closed"
          ? submissionWindowLockedAfterVote
            ? "Submissions closed"
            : "Reopen submissions"
          : resolvedSubmissionState === "scheduled"
            ? "Open submissions"
            : "Close submissions"

    return (
      <div className="relative overflow-hidden rounded-xl border border-brand-primary/20 bg-white p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10">
              <CheckCircle2 className="size-5 text-brand-primary" />
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
                <div className="rounded-full border border-border/70 bg-muted/30 px-3 py-1.5">
                  Started:{" "}
                  <span className="font-medium text-foreground">
                    {activeTopic.scheduledStart
                      ? formatTimestamp(activeTopic.scheduledStart)
                      : "Not set"}
                  </span>
                </div>
                {resolvedSubmissionState === "closed" ? (
                  <div className="rounded-full border border-border/70 bg-muted/30 px-3 py-1.5">
                    Ended:{" "}
                    <span className="font-medium text-foreground">
                      {activeTopic.scheduledEnd ? formatTimestamp(activeTopic.scheduledEnd) : "—"}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-col items-start sm:items-end">
              <p className="text-2xl font-semibold tabular-nums leading-none text-foreground">
                {submissionCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">submissions</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                size="sm"
                onClick={() => onEditSubmissionWindow(activeTopic)}
                disabled={isLoading}
                className="h-10 gap-1.5 sm:h-9"
              >
                {resolvedSubmissionState === "not-opened" ||
                resolvedSubmissionState === "scheduled" ? (
                  <Play className="size-3" />
                ) : resolvedSubmissionState === "closed" ? (
                  submissionWindowLockedAfterVote ? (
                    <Lock className="size-3" />
                  ) : (
                    <RotateCcw className="size-3" />
                  )
                ) : (
                  <Square className="size-3" />
                )}
                {submissionWindowActionLabel}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(activeTopic)}
                disabled={isLoading}
                className="h-10 gap-1.5 sm:h-9"
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
    <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <TagIcon className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">No active topic</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Step 1: activate a topic below. Step 2: open submissions from the active topic panel.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onCreate} className="h-10 w-full gap-1.5 sm:h-9 sm:w-auto">
          <Plus className="size-3.5" />
          Create topic
        </Button>
      </div>
    </div>
  )
}
