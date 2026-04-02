"use client";

import type { Topic } from "@blikka/db";
import { CircleDot, Pencil, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTimestamp, VISIBILITY_LABELS } from "../_lib/formatting";

type TopicListItemProps = {
  topic: Topic;
  submissionCount: number;
  onActivate: (topic: Topic) => void;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
  isLoading: boolean;
};

export function TopicListItem({
  topic,
  submissionCount,
  onActivate,
  onEdit,
  onDelete,
  isLoading,
}: TopicListItemProps) {
  return (
    <div className="group rounded-xl border border-border bg-card p-3 transition-colors hover:border-muted-foreground/30 sm:p-4">
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <CircleDot className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {topic.name}
              </span>
              <Badge
                variant="outline"
                className="h-5 rounded-full px-2 text-[10px] tracking-wider"
              >
                {
                  VISIBILITY_LABELS[
                    topic.visibility as keyof typeof VISIBILITY_LABELS
                  ]
                }
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                {topic.activatedAt
                  ? `Last active ${formatTimestamp(topic.activatedAt)}`
                  : `Created ${formatTimestamp(topic.createdAt)}`}
              </span>
              {topic.scheduledStart ? (
                <span>Opened {formatTimestamp(topic.scheduledStart)}</span>
              ) : null}
              {topic.scheduledEnd ? (
                <span>Closed {formatTimestamp(topic.scheduledEnd)}</span>
              ) : null}
              <span className="tabular-nums">
                {submissionCount} submissions
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-start">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onActivate(topic)}
            disabled={isLoading}
            className="h-9 gap-1 px-2 text-xs sm:gap-1.5 sm:px-3"
          >
            <Zap className="size-3 shrink-0" />
            <span className="truncate">Activate</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(topic)}
            disabled={isLoading}
            className="h-9 gap-1 px-2 text-xs sm:gap-1.5 sm:px-3"
          >
            <Pencil className="size-3 shrink-0" />
            <span className="truncate">Edit</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(topic)}
            disabled={isLoading}
            aria-label={`Delete ${topic.name}`}
            className="h-9 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive sm:gap-1.5 sm:px-3"
          >
            <Trash2 className="size-3 shrink-0" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
