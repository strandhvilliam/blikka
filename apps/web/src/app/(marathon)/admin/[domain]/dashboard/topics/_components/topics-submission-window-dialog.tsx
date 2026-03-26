"use client"

import type { Topic } from "@blikka/db"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Lock, Play, RotateCcw, Square } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { getByCameraSubmissionWindowState } from "@/lib/by-camera/by-camera-submission-window-state"

interface TopicsSubmissionWindowDialogProps {
  topic: Topic | null
  votingHasStarted: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function TopicsSubmissionWindowDialog({
  topic,
  votingHasStarted,
  isOpen,
  onOpenChange,
}: TopicsSubmissionWindowDialogProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { mutate: updateTopic, isPending: isUpdatingTopic } = useMutation(
    trpc.topics.update.mutationOptions({
      onSuccess: () => {
        toast.success("Submission window updated")
        onOpenChange(false)
      },
      onError: (error) => {
        toast.error("Failed to update submission window", {
          description: error.message,
        })
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
      },
    }),
  )

  const isActiveTopic = topic?.visibility === "active"
  const submissionState = topic
    ? getByCameraSubmissionWindowState(topic)
    : null
  const isSubmissionClosed = submissionState === "closed"
  const submissionClosedReadOnly = isSubmissionClosed && votingHasStarted
  const canReopenAfterClose =
    isActiveTopic && isSubmissionClosed && !votingHasStarted
  const isCurrentlyOpen =
    isActiveTopic &&
    topic &&
    topic.scheduledStart != null &&
    new Date(topic.scheduledStart) <= new Date() &&
    (topic.scheduledEnd == null || new Date(topic.scheduledEnd) > new Date())
  const canOpenSubmissions =
    isActiveTopic &&
    !submissionClosedReadOnly &&
    !canReopenAfterClose &&
    !isCurrentlyOpen

  const dialogTitle = submissionClosedReadOnly
    ? "Submission window closed"
    : canReopenAfterClose
      ? "Reopen submissions"
      : isCurrentlyOpen
        ? "Close submissions"
        : "Open submissions"

  const handleOpenNow = () => {
    if (!topic || !isActiveTopic) {
      return
    }

    if (topic.visibility !== "active") {
      toast.error("Only the active topic can manage submissions")
      return
    }

    const submissionClosed =
      getByCameraSubmissionWindowState(topic) === "closed"

    if (submissionClosed && votingHasStarted) {
      toast.error("Voting has already started; submissions cannot be reopened")
      return
    }

    updateTopic({
      domain,
      id: topic.id,
      data: {
        scheduledStart: new Date().toISOString(),
        scheduledEnd: null,
      },
    })
  }

  const handleCloseNow = () => {
    if (!topic || !isCurrentlyOpen) {
      return
    }

    updateTopic({
      domain,
      id: topic.id,
      data: {
        scheduledEnd: new Date().toISOString(),
      },
    })
  }

  const handleReopen = () => {
    if (!topic || !canReopenAfterClose) {
      return
    }

    updateTopic({
      domain,
      id: topic.id,
      data: { scheduledEnd: null },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {submissionClosedReadOnly
              ? `Voting is underway for ${topic?.name ?? "this topic"}. Submissions cannot be reopened from here.`
              : canReopenAfterClose
                ? `Submissions closed for ${topic?.name ?? "this topic"}. You can open them again until voting starts.`
                : isCurrentlyOpen
                  ? `Submissions are open for ${topic?.name ?? "this topic"}. Close when uploads should no longer be accepted.`
                  : `Open submissions for ${topic?.name ?? "this topic"} now.`}
          </DialogDescription>
        </DialogHeader>

        {!isActiveTopic ? (
          <>
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Active topic required</AlertTitle>
              <AlertDescription>
                Submission timing can only be edited for the current active topic.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {isActiveTopic && submissionClosedReadOnly ? (
          <>
            <Alert variant="destructive">
              <Lock />
              <AlertTitle>Voting has started</AlertTitle>
              <AlertDescription>
                The submission window cannot be reopened because voting is
                already underway for this topic. Manage deadlines from the
                voting page if you need to adjust voting.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {isActiveTopic && canReopenAfterClose ? (
          <>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUpdatingTopic}
              >
                Cancel
              </Button>
              <PrimaryButton
                type="button"
                className="gap-1.5"
                onClick={handleReopen}
                disabled={isUpdatingTopic}
              >
                <RotateCcw className="size-3.5" />
                {isUpdatingTopic ? "Updating…" : "Reopen submissions"}
              </PrimaryButton>
            </DialogFooter>
          </>
        ) : null}

        {isActiveTopic && !submissionClosedReadOnly && isCurrentlyOpen ? (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdatingTopic}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseNow}
              disabled={isUpdatingTopic}
              className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Square className="size-3.5 fill-current" />
              {isUpdatingTopic ? "Closing…" : "Close now"}
            </Button>
          </DialogFooter>
        ) : null}

        {isActiveTopic && canOpenSubmissions ? (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdatingTopic}
            >
              Cancel
            </Button>
            <PrimaryButton
              type="button"
              className="gap-1.5"
              onClick={handleOpenNow}
              disabled={isUpdatingTopic}
            >
              <Play className="size-3.5" />
              {isUpdatingTopic ? "Opening…" : "Open now"}
            </PrimaryButton>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
