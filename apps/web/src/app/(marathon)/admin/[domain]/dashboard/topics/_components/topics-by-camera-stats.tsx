"use client";

import type { Topic } from "@blikka/db";

type TopicsByCameraStatsProps = {
  topicsCount: number;
  totalSubmissions: number;
  activeTopic: Topic | null;
};

export function TopicsByCameraStats({
  topicsCount,
  totalSubmissions,
  activeTopic,
}: TopicsByCameraStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-gothic text-xs text-muted-foreground">Topics</p>
        <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
          {topicsCount}
        </p>
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
          {activeTopic ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Accepting submissions
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground/40" />
              No active topic
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
