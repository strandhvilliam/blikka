"use client"

import type { Topic } from "@blikka/db"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTopicsByCameraDialogState } from "../_hooks/use-topics-by-camera-dialog-state"
import { getByCameraSubmissionWindowState } from "@/lib/by-camera/by-camera-submission-window-state"
import { getVotingLifecycleState } from "@/lib/voting-lifecycle"
import { TopicsCreateDialog } from "./topics-create-dialog"
import { TopicsEditDialog } from "./topics-edit-dialog"
import { TopicsDeleteDialog } from "./topics-delete-dialog"
import { TopicsActivateDialog } from "./topics-activate-dialog"
import { TopicsByCameraHeader } from "./topics-by-camera-header"
import { TopicsByCameraEmptyState } from "./topics-by-camera-empty-state"
import { ActiveTopicBanner } from "./active-topic-banner"
import { TopicsHistoryList } from "./topics-history-list"
import { TopicsSubmissionWindowDialog } from "./topics-submission-window-dialog"

export function TopicsByCamera() {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const {
    dialog,
    topicId,
    closeDialog,
    openCreate,
    openEdit,
    openDelete,
    openSubmissionWindow,
    openActivate,
  } = useTopicsByCameraDialogState()

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  const { data: submissionCounts } = useSuspenseQuery(
    trpc.topics.getWithSubmissionCount.queryOptions({
      domain,
    }),
  )

  const topics = marathon?.topics ?? []
  const submissionCountMap = new Map(submissionCounts.map((row) => [row.id, row.count]))
  const sortedTopics = [...topics].sort((a, b) => a.orderIndex - b.orderIndex)
  const activeTopic = sortedTopics.find((topic) => topic.visibility === "active") ?? null
  const activeTopicSubmissionState = getByCameraSubmissionWindowState(activeTopic)
  const { data: activeVotingSummary } = useQuery({
    ...trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic?.id ?? 0,
    }),
    enabled: activeTopic != null,
  })
  const historyTopics = sortedTopics
    .filter((topic) => topic.id !== activeTopic?.id)
    .sort((a, b) => {
      const at = a.activatedAt
        ? new Date(a.activatedAt).getTime()
        : Number.NEGATIVE_INFINITY
      const bt = b.activatedAt
        ? new Date(b.activatedAt).getTime()
        : Number.NEGATIVE_INFINITY
      if (bt !== at) return bt - at
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  const activeVotingWindow = activeVotingSummary?.votingWindow ?? null
  const activeVotingHasStarted =
    getVotingLifecycleState(activeVotingWindow ?? { startsAt: null, endsAt: null }) !==
    "not-started"

  const selectedTopic = topicId != null ? (topics.find((t) => t.id === topicId) ?? null) : null

  const { mutate: activateTopic, isPending: isActivatingTopic } = useMutation(
    trpc.topics.activate.mutationOptions({
      onSuccess: () => {
        toast.success("Topic activated", {
          description: "Open submissions from the active topic panel when ready.",
        })
      },
      onError: (error) => {
        toast.error(error.message || "Failed to activate topic")
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.uploadFlow.getPublicMarathon.queryKey({ domain }),
        })
      },
    }),
  )

  const { mutate: deleteTopic, isPending: isDeletingTopic } = useMutation(
    trpc.topics.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Topic deleted")
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete topic")
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.uploadFlow.getPublicMarathon.queryKey({ domain }),
        })
      },
    }),
  )

  const isLoading = isDeletingTopic || isActivatingTopic

  const handleActivateClick = (topic: Topic) => {
    openActivate(topic.id)
  }

  const handleActivateConfirm = (topic: Topic) => {
    activateTopic(
      {
        domain,
        id: topic.id,
      },
      {
        onSuccess: () => closeDialog(),
      },
    )
  }

  const handleEditClick = (topic: Topic) => {
    openEdit(topic.id)
  }

  const handleDeleteClick = (topic: Topic) => {
    openDelete(topic.id)
  }

  const handleSubmissionWindowClick = (topic: Topic) => {
    openSubmissionWindow(topic.id)
  }

  const handleDeleteConfirm = (topic: Topic) => {
    deleteTopic({ domain, id: topic.id })
    closeDialog()
  }

  return (
    <div className="flex flex-col gap-8">
      <TopicsByCameraHeader onCreateClick={openCreate} isLoading={isLoading} />

      <TopicsCreateDialog
        isOpen={dialog === "create"}
        onOpenChange={(open) => !open && closeDialog()}
        showActiveToggle
        defaultActive
      />

      {topics.length === 0 ? (
        <TopicsByCameraEmptyState onCreateClick={openCreate} />
      ) : (
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex items-center gap-2.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
                Active Topic
              </p>
            </div>
            <ActiveTopicBanner
              activeTopic={activeTopic}
              submissionState={activeTopicSubmissionState}
              votingHasStarted={activeVotingHasStarted}
              submissionCount={submissionCountMap.get(activeTopic?.id ?? 0) ?? 0}
              onEdit={handleEditClick}
              onEditSubmissionWindow={handleSubmissionWindowClick}
              onCreate={openCreate}
              isLoading={isLoading}
            />
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
                  All topics
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 text-end">
                <p className="text-xs tabular-nums text-muted-foreground">
                  {historyTopics.length}{" "}
                  {historyTopics.length === 1 ? "topic" : "topics"}
                </p>
                <p className="text-[10px] leading-tight text-muted-foreground/85">
                  Sorted by last activation
                </p>
              </div>
            </div>

            <TopicsHistoryList
              topics={historyTopics}
              submissionCountMap={submissionCountMap}
              onActivate={handleActivateClick}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              isLoading={isLoading}
            />
          </section>
        </div>
      )}

      <TopicsDeleteDialog
        topic={selectedTopic}
        isOpen={dialog === "delete"}
        onOpenChange={(open) => !open && closeDialog()}
        onConfirm={handleDeleteConfirm}
      />

      <TopicsEditDialog
        topic={selectedTopic}
        isOpen={dialog === "edit"}
        onOpenChange={(open) => !open && closeDialog()}
      />

      <TopicsSubmissionWindowDialog
        topic={selectedTopic}
        votingHasStarted={selectedTopic?.id === activeTopic?.id ? activeVotingHasStarted : false}
        isOpen={dialog === "submission-window"}
        onOpenChange={(open) => !open && closeDialog()}
      />

      <TopicsActivateDialog
        topicToActivate={selectedTopic}
        activeTopic={activeTopic}
        activeVotingWindow={activeVotingWindow}
        isOpen={dialog === "activate"}
        onOpenChange={(open) => !open && closeDialog()}
        onConfirm={handleActivateConfirm}
        isPending={isActivatingTopic}
      />
    </div>
  )
}
