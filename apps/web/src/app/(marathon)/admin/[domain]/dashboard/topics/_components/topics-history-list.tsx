"use client";

import type { Topic } from "@blikka/db";
import { Layers } from "lucide-react";
import { TopicListItem } from "./topic-list-item";

type TopicsHistoryListProps = {
  topics: Topic[];
  submissionCountMap: Map<number, number>;
  onActivate: (topic: Topic) => void;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
  isLoading: boolean;
};

export function TopicsHistoryList({
  topics,
  submissionCountMap,
  onActivate,
  onEdit,
  onDelete,
  isLoading,
}: TopicsHistoryListProps) {
  if (topics.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center sm:px-6 sm:py-10">
        <Layers className="mx-auto size-5 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          No other topics yet. Create another topic to build your event history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {topics.map((topic) => (
        <TopicListItem
          key={topic.id}
          topic={topic}
          submissionCount={submissionCountMap.get(topic.id) ?? 0}
          onActivate={onActivate}
          onEdit={onEdit}
          onDelete={onDelete}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
