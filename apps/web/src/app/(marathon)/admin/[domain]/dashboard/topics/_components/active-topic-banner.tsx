"use client";

import type { Topic } from "@blikka/db";
import { CheckCircle2, Clock, Pencil, Plus, TagIcon, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "../_lib/formatting";

type ActiveTopicBannerProps = {
  activeTopic: Topic | null;
  submissionCount: number;
  onEdit: (topic: Topic) => void;
  onCreate: () => void;
  isLoading: boolean;
};

export function ActiveTopicBanner({
  activeTopic,
  submissionCount,
  onEdit,
  onCreate,
  isLoading,
}: ActiveTopicBannerProps) {
  if (activeTopic) {
    const scheduledInFuture =
      activeTopic.scheduledStart &&
      new Date(activeTopic.scheduledStart) > new Date();

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
              <div className="flex items-center gap-2.5">
                <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
                  {activeTopic.name}
                </h3>
                {scheduledInFuture ? (
                  <Badge className="h-5 shrink-0 gap-1 rounded-full border-blue-200 bg-blue-50 px-2 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                    <Clock className="size-3" />
                    Scheduled
                  </Badge>
                ) : (
                  <Badge className="h-5 shrink-0 gap-1 rounded-full border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                    <CheckCircle2 className="size-3" />
                    Active
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {scheduledInFuture ? (
                  <>
                    Submissions open at{" "}
                    {formatTimestamp(activeTopic.scheduledStart)}
                  </>
                ) : (
                  <>
                    Active since{" "}
                    {formatTimestamp(
                      activeTopic.activatedAt ?? activeTopic.createdAt,
                    )}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex flex-col items-end">
              <p className="text-2xl font-semibold tabular-nums leading-none text-foreground">
                {submissionCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">submissions</p>
            </div>
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
    );
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
              Activate a topic below to start accepting submissions
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onCreate} className="gap-1.5">
          <Plus className="size-3.5" />
          Create topic
        </Button>
      </div>
    </div>
  );
}
