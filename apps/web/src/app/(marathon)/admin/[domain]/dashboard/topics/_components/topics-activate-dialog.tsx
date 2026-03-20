"use client"

import type { Topic } from "@blikka/db"
import { Loader2, Zap } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getByCameraSubmissionWindowState } from "@/lib/by-camera/by-camera-submission-window-state"
import { getVotingLifecycleState } from "@/lib/voting-lifecycle"

interface TopicsActivateDialogProps {
  topicToActivate: Topic | null
  activeTopic: Topic | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (topic: Topic) => void
  isPending: boolean
}

function getActivateDialogMessage(
  topicToActivate: Topic,
  activeTopic: Topic | null,
): { title: string; description: string } {
  const topicName = topicToActivate.name

  if (!activeTopic) {
    return {
      title: `Activate topic "${topicName}"?`,
      description: "This topic will become the active topic for by-camera submissions.",
    }
  }

  const submissionState = getByCameraSubmissionWindowState(activeTopic)
  const votingState = getVotingLifecycleState({
    startsAt: activeTopic.votingStartsAt,
    endsAt: activeTopic.votingEndsAt,
  })

  const submissionsOngoing = submissionState === "open"
  const votingActive = votingState === "active"

  if (submissionsOngoing && votingActive) {
    return {
      title: `Switch to topic "${topicName}"?`,
      description:
        "The current topic has submissions ongoing and voting in progress. Participants may be uploading or voting. Switching will affect them.",
    }
  }

  if (submissionsOngoing) {
    return {
      title: `Switch to topic "${topicName}"?`,
      description:
        "The current topic has submissions ongoing. Participants may be uploading. Switching will affect them.",
    }
  }

  if (votingActive) {
    return {
      title: `Switch to topic "${topicName}"?`,
      description:
        "The current topic has voting in progress. Participants may be voting. Switching will affect them.",
    }
  }

  return {
    title: `Switch to topic "${topicName}"?`,
    description: "The current topic will be deactivated.",
  }
}

export function TopicsActivateDialog({
  topicToActivate,
  activeTopic,
  isOpen,
  onOpenChange,
  onConfirm,
  isPending,
}: TopicsActivateDialogProps) {
  const handleConfirm = () => {
    if (!topicToActivate) return
    onConfirm(topicToActivate)
  }

  const message =
    topicToActivate != null ? getActivateDialogMessage(topicToActivate, activeTopic) : null

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{message?.title ?? "Activate topic?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {message?.description ??
              "This topic will become the active topic for by-camera submissions."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={!topicToActivate || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Activate
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
