"use client"

import type { ByCameraSubmissionWindowState } from "@/lib/by-camera/by-camera-submission-window-state"

type TopicsByCameraStatsProps = {
  topicsCount: number
  totalSubmissions: number
  submissionState: ByCameraSubmissionWindowState
}

const STATUS_COPY: Record<ByCameraSubmissionWindowState, string> = {
  "no-active-topic": "No active topic",
  "not-opened": "Active topic waiting to open",
  scheduled: "Submissions scheduled",
  open: "Accepting submissions",
  closed: "Submission window closed",
}

export function TopicsByCameraStats({
  topicsCount,
  totalSubmissions,
  submissionState,
}: TopicsByCameraStatsProps) {
  const isOpen = submissionState === "open"

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-gothic text-xs text-muted-foreground">Topics</p>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">{topicsCount}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-gothic text-xs text-muted-foreground">Submissions</p>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
          {totalSubmissions}
        </p>
      </div>
      <div className="col-span-2 rounded-xl border border-border bg-card p-4 sm:col-span-1">
        <p className="font-gothic text-xs text-muted-foreground">Status</p>
        <p className="mt-1.5 text-sm font-medium text-foreground">
          <span
            className={
              submissionState === "no-active-topic"
                ? "inline-flex items-center gap-1.5 text-muted-foreground"
                : "inline-flex items-center gap-1.5"
            }
          >
            <span className="relative flex h-2 w-2">
              {isOpen ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              ) : null}
              <span
                className={
                  submissionState === "no-active-topic"
                    ? "inline-flex h-2 w-2 rounded-full bg-muted-foreground/40"
                    : submissionState === "closed"
                      ? "inline-flex h-2 w-2 rounded-full bg-amber-500"
                      : submissionState === "scheduled"
                        ? "inline-flex h-2 w-2 rounded-full bg-blue-500"
                        : submissionState === "not-opened"
                          ? "inline-flex h-2 w-2 rounded-full bg-slate-500"
                          : "relative inline-flex h-2 w-2 rounded-full bg-emerald-500"
                }
              />
            </span>
            {STATUS_COPY[submissionState]}
          </span>
        </p>
      </div>
    </div>
  )
}
