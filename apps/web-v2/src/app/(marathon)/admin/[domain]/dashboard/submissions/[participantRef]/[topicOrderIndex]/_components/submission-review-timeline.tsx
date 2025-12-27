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
import { Participant, Submission } from "@blikka/db"

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
}

export function SubmissionReviewTimeline({
  submission,
  participant,
  hasIssues,
}: ReviewTimelineProps) {
  // Check if participant is verified
  const isParticipantVerified = participant.status === "verified"

  const reviewSteps: ReviewStep[] = [
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
              "MMM d, yyyy HH:mm"
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
    // Staff Verification Step - can be pending, completed (approved), or completed (rejected)
    submission.status === "approved" || isParticipantVerified
      ? {
          status: "completed",
          title: "Staff Verified",
          description: "Photo verified for competition",
          timestamp: format(
            new Date(
              isParticipantVerified && participant.updatedAt
                ? participant.updatedAt
                : submission.updatedAt || submission.createdAt
            ),
            "MMM d, yyyy HH:mm"
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
            },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Submission Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {reviewSteps.map((step, index) => (
            <div key={index} className="flex gap-4 pb-8 last:pb-0 relative">
              {index < reviewSteps.length - 1 && (
                <div
                  className={`absolute left-[15px] z-10 top-[30px] bottom-0 w-[2px] ${
                    step.status === "completed" && reviewSteps[index + 1]?.status === "completed"
                      ? "bg-primary"
                      : step.status === "completed" &&
                          (reviewSteps[index + 1]?.status === "pending" ||
                            reviewSteps[index + 1]?.status === "upcoming")
                        ? "bg-gradient-to-b from-primary to-blue-500"
                        : step.status === "pending"
                          ? "bg-gradient-to-b from-blue-500 to-muted-foreground/30"
                          : "bg-muted-foreground/30"
                  }`}
                />
              )}
              <div
                className={`rounded-full h-8 w-8 flex items-center justify-center z-20 border-2 ${
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
              <div className={`flex-1 space-y-1 ${step.status === "upcoming" ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <p
                    className={`font-medium ${
                      step.status === "completed"
                        ? "text-primary"
                        : step.status === "pending"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                    {step.status === "pending" && (
                      <span className="ml-2 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 font-medium py-0.5 px-2 rounded-full">
                        Active
                      </span>
                    )}
                    {step.status === "upcoming" && (
                      <span className="ml-2 text-xs bg-muted/20 text-muted-foreground font-medium py-0.5 px-2 rounded-full">
                        Pending
                      </span>
                    )}
                  </p>
                  {step.timestamp && (
                    <span className="text-sm text-muted-foreground">{step.timestamp}</span>
                  )}
                </div>
                <p
                  className={`text-sm ${
                    step.isPending ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"
                  }`}
                >
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
