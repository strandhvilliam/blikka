"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type {
  CompetitionClass,
  DeviceGroup,
  Participant,
  Submission,
  Topic,
  ValidationResult,
  VotingSession,
} from "@blikka/db"
import { format } from "date-fns"
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  Clock,
  Image,
  Smartphone,
  Upload,
  Trophy,
  Vote,
  Clock3,
  Link2,
  Send,
  Plus,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { formatDomainPathname } from "@/lib/utils"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { SubmissionValidationSteps } from "./submission-validation-steps"
import { SubmissionExifDataDisplay } from "./submission-exif-data-display"

interface VoteStats {
  voteCount: number
  position: number
  totalSubmissions: number
  participantVoteInfo: {
    hasVoted: boolean
    votedAt: string | null
    votedSubmissionId: number | null
    votedTopicName: string | null
  } | null
}

interface VotingSessionData {
  hasSession: boolean
  session?: VotingSession
  hasVoted?: boolean
  notificationLastSentAt?: string | null
}

interface SubmissionMetadataPanelProps {
  submission: Submission
  topic: Topic
  participant: Participant & {
    competitionClass: CompetitionClass | null
    deviceGroup: DeviceGroup | null
  }
  hasIssues: boolean
  validationResults: ValidationResult[]
  marathonMode?: string
  voteStats?: VoteStats
  votingSessionData?: VotingSessionData
  domain: string
  topics: Topic[]
}

function headlineBadges({
  hasIssues,
  submission,
  participant,
  isByCameraMode,
}: {
  hasIssues: boolean
  submission: Submission
  participant: Participant
  isByCameraMode: boolean
}) {
  const isVerified = participant.status === "verified"

  if (submission.status === "rejected") {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
        Rejected
      </Badge>
    )
  }

  if (!isByCameraMode && isVerified) {
    return (
      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">
        Verified
      </Badge>
    )
  }

  if (hasIssues) {
    return (
      <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-900">
        Needs attention
      </Badge>
    )
  }

  if (submission.status === "uploaded" && !isByCameraMode && !isVerified) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
        Awaiting review
      </Badge>
    )
  }

  if (submission.status === "initialized") {
    return (
      <Badge variant="outline" className="border-muted-foreground/25 bg-muted/40 text-muted-foreground">
        Awaiting upload
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">
      Looks good
    </Badge>
  )
}

export function SubmissionMetadataPanel({
  topics,
  submission,
  topic,
  participant,
  hasIssues,
  validationResults,
  marathonMode,
  voteStats,
  votingSessionData,
  domain,
}: SubmissionMetadataPanelProps) {
  const isByCameraMode = marathonMode === "by-camera"
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const activeByCameraTopic = topics.find((t) => t.visibility === "active")

  const createOrUpdateVotingSessionMutation = useMutation(
    trpc.voting.createOrUpdateVotingSession.mutationOptions({
      onSuccess: (data) => {
        if (data.action === "created") {
          toast.success("Voting session created and invite sent")
        } else if (data.action === "resent") {
          toast.success("Vote invite resent")
        } else if (data.action === "already_voted") {
          toast.info("Participant has already voted")
        }
        queryClient.invalidateQueries({
          queryKey: trpc.voting.getVotingSessionByParticipant.queryKey({
            participantId: participant.id,
            topicId: activeByCameraTopic?.id ?? 0,
            domain,
          }),
        })
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create voting session")
      },
    }),
  )

  const handleCreateOrUpdateVotingSession = () => {
    if (!activeByCameraTopic) {
      toast.error("No active by-camera topic found")
      return
    }

    createOrUpdateVotingSessionMutation.mutate({
      participantId: participant.id,
      topicId: activeByCameraTopic.id,
      domain,
    })
  }

  const accordionDefault =
    hasIssues && validationResults.length > 0 ? "photo-checks" : undefined

  return (
    <Card className="overflow-hidden border shadow-sm">
      <CardHeader className="space-y-3 pb-2 pt-6 px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg font-semibold font-gothic leading-tight">
              About this photo
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              What you need to know at a glance. Open the sections below for technical detail.
            </p>
            <p className="text-sm font-medium pt-1">
              <span className="text-muted-foreground font-normal">Category: </span>
              {topic.name}
            </p>
          </div>
          {headlineBadges({ hasIssues, submission, participant, isByCameraMode })}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-5 pb-6 pt-2">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Upload className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">When it was uploaded</p>
              <p className="text-sm font-medium">
                {format(new Date(submission.createdAt), "MMM d, yyyy")}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(submission.createdAt), "HH:mm:ss")}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700">
              {participant.deviceGroup?.icon === "smartphone" ? (
                <Smartphone className="h-4 w-4" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">Camera type</p>
              <p className="text-sm font-medium">
                {participant.deviceGroup?.name || "Not specified"}
              </p>
              {participant.deviceGroup?.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {participant.deviceGroup.description}
                </p>
              )}
            </div>
          </div>

          {!isByCameraMode && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700">
                  {participant.competitionClass?.numberOfPhotos !== undefined ? (
                    <span className="text-xs font-semibold tabular-nums">
                      {participant.competitionClass.numberOfPhotos}
                    </span>
                  ) : (
                    <Image className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">Competition class</p>
                  <p className="text-sm font-medium">
                    {participant.competitionClass?.name || "Not assigned"}
                  </p>
                  {participant.competitionClass?.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {participant.competitionClass.description}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {isByCameraMode && voteStats && (
          <>
            <Separator />
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-900">
                <Trophy className="h-3.5 w-3.5" />
                Voting results
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold tabular-nums text-amber-900">
                    #{voteStats.position}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {voteStats.totalSubmissions} photos
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums text-amber-900">
                    {voteStats.voteCount}
                  </p>
                  <p className="text-xs text-muted-foreground">votes</p>
                </div>
              </div>
            </div>
          </>
        )}

        {isByCameraMode && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Vote className="h-3.5 w-3.5" />
                Participant&apos;s vote
              </div>
              {voteStats?.participantVoteInfo?.hasVoted ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Has voted</span>
                  </div>
                  {voteStats.participantVoteInfo.votedAt && (
                    <p className="text-xs text-muted-foreground">
                      Voted on{" "}
                      {format(new Date(voteStats.participantVoteInfo.votedAt), "MMM d, yyyy HH:mm")}
                    </p>
                  )}
                  {voteStats.participantVoteInfo.votedTopicName && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Voted for</p>
                      <p className="text-sm font-medium">
                        {voteStats.participantVoteInfo.votedTopicName}
                      </p>
                    </div>
                  )}
                  {voteStats.participantVoteInfo.votedSubmissionId &&
                    voteStats.participantVoteInfo.votedSubmissionId !== submission.id && (
                      <Link
                        href={formatDomainPathname(
                          `/admin/dashboard/submissions/${participant.reference}/${voteStats.participantVoteInfo.votedSubmissionId}`,
                          domain,
                        )}
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Link2 className="h-3 w-3" />
                        View their choice
                      </Link>
                    )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    <span className="text-sm">Not voted yet</span>
                  </div>
                  {!voteStats?.participantVoteInfo?.hasVoted && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleCreateOrUpdateVotingSession}
                      disabled={createOrUpdateVotingSessionMutation.isPending}
                    >
                      {createOrUpdateVotingSessionMutation.isPending ? (
                        <Clock className="h-4 w-4 animate-spin" />
                      ) : votingSessionData?.hasSession ? (
                        <Send className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {votingSessionData?.hasSession ? "Resend vote invite" : "Start voting session"}
                    </Button>
                  )}
                  {votingSessionData?.hasSession && votingSessionData.notificationLastSentAt && (
                    <p className="text-xs text-muted-foreground">
                      Invite last sent:{" "}
                      {format(new Date(votingSessionData.notificationLastSentAt), "MMM d, HH:mm")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {validationResults.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Photo checks summary
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-green-200 bg-green-500/5 p-2">
                  <div className="text-xl font-bold text-green-700 tabular-nums">
                    {validationResults.filter((r) => r.outcome === "passed").length}
                  </div>
                  <div className="text-xs text-muted-foreground">Passed</div>
                </div>
                <div className="rounded-lg border border-yellow-200 bg-yellow-500/5 p-2">
                  <div className="text-xl font-bold text-yellow-700 tabular-nums">
                    {
                      validationResults.filter(
                        (r) => r.severity === "warning" && r.outcome === "failed",
                      ).length
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">Warnings</div>
                </div>
                <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-2">
                  <div className="text-xl font-bold text-destructive tabular-nums">
                    {
                      validationResults.filter(
                        (r) => r.severity === "error" && r.outcome === "failed",
                      ).length
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">Errors</div>
                </div>
              </div>
              {hasIssues && (
                <div className="flex gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-orange-900">Action needed</p>
                    <p className="text-xs text-orange-800 mt-0.5">
                      Review the photo checks below and follow up with the participant if needed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <Accordion
          type="single"
          collapsible
          className="w-full rounded-lg border border-border/80"
          defaultValue={accordionDefault}
        >
          <AccordionItem value="photo-checks" className="border-b px-4">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline py-4">
              Photo checks (technical)
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-xs text-muted-foreground mb-3">
                Automated rules we run on each upload. Use this when you need the exact findings.
              </p>
              {validationResults.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No check results yet for this file.
                </p>
              ) : (
                <SubmissionValidationSteps validationResults={validationResults} />
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="technical" className="border-b-0 px-4">
            <AccordionTrigger className="text-sm font-semibold hover:no-underline py-4">
              Camera &amp; file details
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                For troubleshooting or advanced review — storage paths and camera metadata.
              </p>
              <SubmissionExifDataDisplay exifData={submission.exif || {}} />
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0">Stored file ref</span>
                  <span
                    className="font-mono text-xs truncate text-right max-w-[200px]"
                    title={submission.key || "N/A"}
                  >
                    {submission.key ? `…${submission.key.slice(-20)}` : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Preview thumbnail</span>
                  {submission.thumbnailKey ? (
                    <Badge
                      variant="outline"
                      className="h-5 border-green-200 bg-green-500/10 text-green-700"
                    >
                      Available
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="h-5 border-red-200 bg-red-500/10 text-red-700"
                    >
                      Missing
                    </Badge>
                  )}
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Metadata fields</span>
                  {submission.exif && Object.keys(submission.exif).length > 0 ? (
                    <Badge
                      variant="outline"
                      className="h-5 border-green-200 bg-green-500/10 text-green-700"
                    >
                      {Object.keys(submission.exif).length} fields
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="h-5 border-red-200 bg-red-500/10 text-red-700"
                    >
                      Not available
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
