import { format } from "date-fns"
import { AlertTriangle, Camera, Smartphone, Upload } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { SubmissionReviewTimeline } from "./submission-review-timeline"
import { CompetitionClass, DeviceGroup, Participant, Submission, Topic } from "@blikka/db"

interface SubmissionDetailsProps {
  submission: Submission
  topic: Topic
  participant: Participant & {
    competitionClass: CompetitionClass | null
    deviceGroup: DeviceGroup | null
  }
  hasIssues: boolean
}

export function SubmissionDetails({
  submission,
  participant,
  topic,
  hasIssues,
}: SubmissionDetailsProps) {
  return (
    <div className="space-y-6 mt-4">
      <Card className="p-4">
        <CardContent className="space-y-6 p-2">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">Uploaded At</h3>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <p>{format(new Date(submission.createdAt), "MMM d, yyyy HH:mm")}</p>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">Topic</h3>
              <p>{topic.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">Device Type</h3>
              <div className="flex items-center gap-2">
                {participant.deviceGroup?.icon === "smartphone" ? (
                  <>
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <p>Smartphone</p>
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <p>Camera</p>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">Competition Class</h3>
              <p>{participant.competitionClass?.name || "Not assigned"}</p>
            </div>
          </div>

          {hasIssues && (
            <div className="mt-6 p-4 bg-destructive/10 rounded-lg">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <p className="font-medium">Processing Issues</p>
              </div>
              <p className="text-sm mt-1">There are validation issues that need to be addressed.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <SubmissionReviewTimeline
        submission={submission}
        participant={participant}
        hasIssues={hasIssues}
      />
    </div>
  )
}
