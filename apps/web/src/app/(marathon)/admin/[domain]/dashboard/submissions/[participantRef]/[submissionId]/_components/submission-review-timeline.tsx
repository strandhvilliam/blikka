"use client"

import {
  CheckCircle2,
  Clock3,
  AlertTriangle,
  XCircle,
  ImageIcon,
  Upload,
  UserCheck,
  History,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import type { Participant, Submission } from "@blikka/db"
import { cn } from "@/lib/utils"

interface ReviewStep {
  status: "completed" | "pending" | "upcoming"
  title: string
  description: string
  timestamp?: string
  icon: React.ComponentType<{ className?: string }>
  isPending?: boolean
}

interface ReviewTimelineProps {
  submission: Submission
  participant: Participant
  marathonMode?: string
}

export function SubmissionReviewTimeline({
  submission,
  participant,
  marathonMode,
}: ReviewTimelineProps) {
  const isParticipantVerified = participant.status === "verified"
  const isByCameraMode = marathonMode === "by-camera"

  const baseSteps: ReviewStep[] = [
    {
      status: "completed",
      title: "Participant initialized",
      description: "Registered in the system",
      timestamp: format(new Date(participant.createdAt), "MMM d, yyyy · HH:mm"),
      icon: UserCheck,
    },
    submission.status === "initialized"
      ? {
          status: "pending",
          title: "Awaiting upload",
          description: "Waiting for participant photo",
          icon: Upload,
          isPending: true,
        }
      : {
          status: "completed",
          title: "Photo uploaded",
          description: "File received",
          timestamp: format(new Date(submission.createdAt), "MMM d, yyyy · HH:mm"),
          icon: ImageIcon,
        },
    submission.status === "initialized"
      ? {
          status: "upcoming",
          title: "Processing",
          description: "Runs after upload",
          icon: AlertTriangle,
        }
      : submission.status === "uploaded"
        ? {
            status: "completed",
            title: "Processed",
            description: "Technical validation done",
            timestamp: format(
              new Date(submission.updatedAt || submission.createdAt),
              "MMM d, yyyy · HH:mm",
            ),
            icon: CheckCircle2,
          }
        : {
            status: "pending",
            title: "Processing",
            description: "Validation in progress",
            icon: AlertTriangle,
            isPending: true,
          },
  ]

  const verificationStep: ReviewStep = isByCameraMode
    ? {
        status: "completed",
        title: "Ready for voting",
        description: "Submission complete",
        timestamp: format(
          new Date(submission.updatedAt || submission.createdAt),
          "MMM d, yyyy · HH:mm",
        ),
        icon: CheckCircle2,
      }
    : submission.status === "approved" || isParticipantVerified
      ? {
          status: "completed",
          title: "Staff verified",
          description: "Approved for competition",
          timestamp: format(
            new Date(
              isParticipantVerified && participant.updatedAt
                ? participant.updatedAt
                : submission.updatedAt || submission.createdAt,
            ),
            "MMM d, yyyy · HH:mm",
          ),
          icon: CheckCircle2,
        }
      : submission.status === "rejected"
        ? {
            status: "completed",
            title: "Rejected",
            description: "Declined by staff",
            timestamp: submission.updatedAt
              ? format(new Date(submission.updatedAt), "MMM d, yyyy · HH:mm")
              : undefined,
            icon: XCircle,
          }
        : submission.status === "uploaded"
          ? {
              status: "pending",
              title: "Awaiting verification",
              description: "Staff review pending",
              icon: Clock3,
              isPending: true,
            }
          : {
              status: "upcoming",
              title: "Verification",
              description: "After processing",
              icon: Clock3,
            }

  const reviewSteps: ReviewStep[] = [...baseSteps, verificationStep]

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Submission timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4 pt-2">
        <ol className="relative">
          {reviewSteps.map((step, index) => {
            const next = reviewSteps[index + 1]
            const lineClass =
              index >= reviewSteps.length - 1
                ? null
                : step.status === "completed" && next?.status === "completed"
                  ? "bg-border"
                  : step.status === "completed" &&
                      (next?.status === "pending" || next?.status === "upcoming")
                    ? "bg-linear-to-b from-foreground/25 to-blue-500/60"
                    : step.status === "pending"
                      ? "bg-linear-to-b from-blue-500/50 to-muted-foreground/25"
                      : "bg-muted-foreground/20"

            return (
              <li key={index} className="relative flex gap-2.5 pb-3 last:pb-0">
                {lineClass ? (
                  <div
                    className={cn("absolute top-7 bottom-0 left-[13px] z-0 w-px", lineClass)}
                    aria-hidden
                  />
                ) : null}
                <div
                  className={cn(
                    "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background",
                    step.status === "completed" &&
                      step.icon !== XCircle &&
                      "text-foreground",
                    step.status === "completed" &&
                      step.icon === XCircle &&
                      "border-destructive/35 text-destructive",
                    step.status === "pending" &&
                      "border-blue-500/80 bg-blue-500/10 text-blue-600 animate-pulse dark:text-blue-400",
                    step.status === "upcoming" && "border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {step.status === "completed" ? (
                    step.icon === XCircle ? (
                      <XCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
                    ) : (
                      <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
                    )
                  ) : (
                    <step.icon className="h-4 w-4" strokeWidth={2.25} />
                  )}
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1 pt-0.5",
                    step.status === "upcoming" && "opacity-70",
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium leading-tight",
                      step.status === "completed" &&
                        step.icon === XCircle &&
                        "text-destructive",
                      step.status === "pending" && "text-blue-600 dark:text-blue-400",
                      step.status === "upcoming" && "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs leading-tight text-muted-foreground",
                      step.isPending && "text-blue-700/85 dark:text-blue-300/85",
                    )}
                  >
                    {step.description}
                  </p>
                  {step.timestamp ? (
                    <span className="mt-1 block font-mono text-xs tabular-nums leading-tight text-muted-foreground">
                      {step.timestamp}
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
