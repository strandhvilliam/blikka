"use client"

import {
  CheckCircle,
  Clock3,
  AlertTriangle,
  XCircle,
  ImageIcon,
  CheckCircle2,
  Upload,
  UserCheck,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import type { Participant, Submission } from "@blikka/db"

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
  hasIssues: boolean
  marathonMode?: string
}

export function SubmissionReviewTimeline({
  submission,
  participant,
  hasIssues,
  marathonMode,
}: ReviewTimelineProps) {
  // Check if participant is verified
  const isParticipantVerified = participant.status === "verified"
  const isByCameraMode = marathonMode === "by-camera"

  // Build steps based on mode
  const baseSteps: ReviewStep[] = [
    {
      status: "completed",
      title: "Participant Initialized",
      description: "Participant registered in the system",
      timestamp: format(new Date(participant.createdAt), "MMM d, yyyy HH:mm"),
      icon: UserCheck,
    },
    // Photo Upload Step - can be pending or completed
    submission.status === "initialized"
      ? {
          status: "pending",
          title: "Awaiting Photo Upload",
          description: "Waiting for participant to upload photo",
          icon: Upload,
          isPending: true,
        }
      : {
          status: "completed",
          title: "Photo Uploaded",
          description: "Photo uploaded by participant",
          timestamp: format(new Date(submission.createdAt), "MMM d, yyyy HH:mm"),
          icon: ImageIcon,
        },
    // Submission Processing Step - can be pending or completed
    submission.status === "initialized"
      ? {
          status: "upcoming",
          title: "Processing Pending",
          description: "Will process after photo upload",
          icon: AlertTriangle,
        }
      : submission.status === "uploaded"
        ? {
            status: "completed",
            title: "Submission Processed",
            description: "Technical validation complete",
            timestamp: format(
              new Date(submission.updatedAt || submission.createdAt),
              "MMM d, yyyy HH:mm",
            ),
            icon: CheckCircle,
          }
        : {
            status: "pending",
            title: "Processing Submission",
            description: "Technical validation in progress",
            icon: AlertTriangle,
            isPending: true,
          },
  ]

  // Staff Verification Step - only for marathon mode
  const verificationStep: ReviewStep = isByCameraMode
    ? {
        status: "completed",
        title: "Submission Complete",
        description: "Photo ready for voting",
        timestamp: format(
          new Date(submission.updatedAt || submission.createdAt),
          "MMM d, yyyy HH:mm",
        ),
        icon: CheckCircle2,
      }
    : submission.status === "approved" || isParticipantVerified
      ? {
          status: "completed",
          title: "Staff Verified",
          description: "Photo verified for competition",
          timestamp: format(
            new Date(
              isParticipantVerified && participant.updatedAt
                ? participant.updatedAt
                : submission.updatedAt || submission.createdAt,
            ),
            "MMM d, yyyy HH:mm",
          ),
          icon: CheckCircle2,
        }
      : submission.status === "rejected"
        ? {
            status: "completed",
            title: "Submission Rejected",
            description: "Photo rejected by staff",
            timestamp: submission.updatedAt
              ? format(new Date(submission.updatedAt), "MMM d, yyyy HH:mm")
              : undefined,
            icon: XCircle,
          }
        : submission.status === "uploaded"
          ? {
              status: "pending",
              title: "Awaiting Staff Verification",
              description: "Waiting for staff to review and verify photo",
              icon: Clock3,
              isPending: true,
            }
          : {
              status: "upcoming",
              title: "Staff Verification Pending",
              description: "Will be reviewed after processing",
              icon: Clock3,
            }

  const reviewSteps: ReviewStep[] = [...baseSteps, verificationStep]

  return (
    <Card className="border shadow-sm">
      <CardHeader className="px-5 pt-6 pb-2">
        <CardTitle className="text-lg font-semibold font-gothic">
          What&apos;s happened so far
        </CardTitle>
        <p className="text-sm text-muted-foreground font-normal pt-1">
          A simple history of this submission — newest context at the bottom.
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-6 pt-2">
        <div className="relative">
          {reviewSteps.map((step, index) => (
            <div key={index} className="flex gap-3 pb-6 last:pb-0 relative">
              {index < reviewSteps.length - 1 && (
                <div
                  className={`absolute left-[15px] z-10 top-[32px] bottom-0 w-0.5 ${
                    step.status === "completed" && reviewSteps[index + 1]?.status === "completed"
                      ? "bg-primary"
                      : step.status === "completed" &&
                          (reviewSteps[index + 1]?.status === "pending" ||
                            reviewSteps[index + 1]?.status === "upcoming")
                        ? "bg-primary/70"
                        : step.status === "pending"
                          ? "bg-sky-500/70"
                          : "bg-border"
                  }`}
                />
              )}
              <div
                className={`rounded-full h-8 w-8 flex items-center justify-center z-20 border-2 shrink-0 ${
                  step.status === "completed"
                    ? "bg-primary/10 border-primary text-primary"
                    : step.status === "pending"
                      ? "bg-blue-500/10 border-blue-500 text-blue-500 animate-pulse"
                      : "bg-muted/10 border-muted-foreground/40 text-muted-foreground"
                }`}
              >
                {step.status === "completed" ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <step.icon className="w-4 h-4" />
                )}
              </div>
              <div
                className={`flex-1 space-y-0.5 ${step.status === "upcoming" ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={`font-medium text-sm ${
                        step.status === "completed"
                          ? "text-primary"
                          : step.status === "pending"
                            ? "text-sky-700"
                            : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        step.isPending ? "text-sky-800" : "text-muted-foreground"
                      }`}
                    >
                      {step.description}
                    </p>
                  </div>
                  {step.timestamp && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {step.timestamp}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
