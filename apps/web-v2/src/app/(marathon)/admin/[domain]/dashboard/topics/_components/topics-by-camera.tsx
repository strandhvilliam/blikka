"use client";

import { useMemo, useState } from "react";
import type { Topic } from "@blikka/db";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Clock, Layers, CheckCircle2, TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { TopicsCreateDialog } from "./topics-create-dialog";
import { TopicsEditDialog } from "./topics-edit-dialog";
import { TopicsDeleteDialog } from "./topics-delete-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const VISIBILITY_LABELS = {
  public: "Public",
  scheduled: "Scheduled",
  private: "Private",
} as const;

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return format(date, "MMM d, yyyy, HH:mm");
}

export function TopicsByCamera() {
  const domain = useDomain();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  );

  const { data: submissionCounts } = useSuspenseQuery(
    trpc.topics.getWithSubmissionCount.queryOptions({
      domain,
    }),
  );

  const topics = useMemo(() => marathon?.topics ?? [], [marathon?.topics]);

  const submissionCountMap = useMemo(() => {
    const map = new Map<number, number>();
    submissionCounts.forEach((row) => {
      map.set(row.id, row.count);
    });
    return map;
  }, [submissionCounts]);

  const sortedTopics = useMemo(() => {
    return [...topics].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [topics]);

  const activeTopic = useMemo(() => {
    return sortedTopics.length > 0 ? sortedTopics[0] : null;
  }, [sortedTopics]);

  const historyTopics = useMemo(() => {
    return sortedTopics.slice(1);
  }, [sortedTopics]);


  const { mutate: activateTopic, isPending: isActivatingTopic } = useMutation(
    trpc.topics.activate.mutationOptions({
      onSuccess: () => {
        toast.success("Topic activated");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to activate topic");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        });
      },
    }),
  );

  const { mutate: deleteTopic, isPending: isDeletingTopic } = useMutation(
    trpc.topics.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Topic deleted");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete topic");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        });
      },
    }),
  );

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  const isLoading = isDeletingTopic || isActivatingTopic;

  const handleSetActive = (topic: Topic) => {
    activateTopic({
      domain,
      id: topic.id,
    });
  };

  const handleEditClick = (topic: Topic) => {
    setSelectedTopic(topic);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (topic: Topic) => {
    setSelectedTopic(topic);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = (topic: Topic) => {
    deleteTopic({ domain, id: topic.id });
    setDeleteDialogOpen(false);
    setSelectedTopic(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">
              Topics
            </h1>
            <Badge
              variant="outline"
              className="text-xs uppercase tracking-wide"
            >
              By-camera
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Each event uses one topic. Create a new topic for the next event,
            then mark it active when you want submissions to start.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1">
              <Layers className="size-3.5" />
              {topics.length} topics
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1">
              <Clock className="size-3.5" />
              {activeTopic
                ? `Current topic active since ${formatTimestamp(activeTopic.activatedAt ?? activeTopic.createdAt)}`
                : "No active topic"}
            </span>
          </div>
        </div>
        <PrimaryButton
          onClick={() => setCreateDialogOpen(true)}
          disabled={isLoading}
        >
          <Plus className="size-4" />
          Add Topic
        </PrimaryButton>
      </div>

      <TopicsCreateDialog
        isOpen={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        showActiveToggle
        defaultActive
      />

      {topics.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle>No topics yet</CardTitle>
            <CardDescription>
              Create your first by-camera topic and mark it active to open
              submissions.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setCreateDialogOpen(true)}>
              Create topic
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Card className="relative overflow-hidden border-primary/20 py-2">
            <div className="absolute inset-0" />
            <CardContent className="relative py-4">
              {activeTopic ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                      <TagIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-lg font-semibold tracking-tight">
                          {activeTopic.name}
                        </h3>
                        <Badge className="h-6 gap-1 text-xs shrink-0">
                          <CheckCircle2 className="size-3" />
                          Active
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="h-5 text-xs">
                          {
                            VISIBILITY_LABELS[
                            activeTopic.visibility as keyof typeof VISIBILITY_LABELS
                            ]
                          }
                        </Badge>
                        <span>
                          Active since{" "}
                          {formatTimestamp(
                            activeTopic.activatedAt ?? activeTopic.createdAt,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="flex flex-col items-end justify-center">
                      <p className="text-2xl font-semibold leading-none">
                        {submissionCountMap.get(activeTopic.id) ?? 0}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submissions
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditClick(activeTopic)}
                        disabled={isLoading}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <TagIcon className="size-4" />
                    </div>
                    <div>
                      <p className="font-medium">No active topic</p>
                      <p className="text-xs text-muted-foreground">
                        Choose one below or create a new topic
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                    Create topic
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardHeader>
              <CardTitle>Topic List</CardTitle>
              <CardDescription>
                Activate the next topic when you are ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyTopics.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
                  No previous topics yet. Create another topic to build your
                  history.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyTopics.map((topic) => (
                    <div
                      key={topic.id}
                      className={cn(
                        "rounded-xl border bg-background/70 p-4 transition hover:border-muted-foreground/40 hover:shadow-sm",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">
                              {topic.name}
                            </span>
                            <Badge variant="secondary">Inactive</Badge>
                            <Badge variant="outline">
                              {
                                VISIBILITY_LABELS[
                                topic.visibility as keyof typeof VISIBILITY_LABELS
                                ]
                              }
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {topic.activatedAt
                                ? `Last activated ${formatTimestamp(topic.activatedAt)}`
                                : `Created ${formatTimestamp(topic.createdAt)}`}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
                              {submissionCountMap.get(topic.id) ?? 0}{" "}
                              submissions
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleSetActive(topic)}
                            disabled={isLoading}
                          >
                            Set Active
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditClick(topic)}
                            disabled={isLoading}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteClick(topic)}
                            disabled={isLoading}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <TopicsDeleteDialog
        topic={selectedTopic}
        isOpen={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setSelectedTopic(null);
          }
        }}
        onConfirm={handleDeleteConfirm}
      />

      <TopicsEditDialog
        topic={selectedTopic}
        isOpen={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedTopic(null);
          }
        }}
        showActiveToggle
      />
    </div>
  );
}
