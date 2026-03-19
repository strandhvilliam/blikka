"use client"

import { notFound } from "next/navigation"
import { Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { SubmissionHeader } from "./submission-header"
import type {
  Participant,
  Submission,
  ValidationResult,
  Topic,
  CompetitionClass,
  DeviceGroup,
} from "@blikka/db"
import { SubmissionImageViewer } from "./submission-image-viewer"
import { SubmissionMetadataPanel } from "./submission-metadata-panel"
import { SubmissionNavigationControls } from "./submission-navigation-controls"
import { SubmissionQuickActions } from "./submission-quick-actions"
import { SubmissionReviewTimeline } from "./submission-review-timeline"
import { Card } from "@/components/ui/card"
import { useDomain } from "@/lib/domain-provider"
import { AWS_S3_BASE_URL } from "@/lib/constants"

const getImageUrl = (submission: Submission) => {
  const thumbnailBaseUrl = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
  const submissionBaseUrl = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME
  if (submission.thumbnailKey && thumbnailBaseUrl) {
    return `${AWS_S3_BASE_URL}/${thumbnailBaseUrl}/${submission.thumbnailKey}`
  }
  if (submission.key && submissionBaseUrl) {
    return `${AWS_S3_BASE_URL}/${submissionBaseUrl}/${submission.key}`
  }
  return null
}

interface VotingDataPanelProps {
  submission: Submission
  topic: Topic
  participant: Participant & {
    competitionClass: CompetitionClass | null
    deviceGroup: DeviceGroup | null
  }
  hasIssues: boolean
  validationResults: ValidationResult[]
  domain: string
  topics: Topic[]
}

function VotingDataPanel({
  submission,
  topic,
  participant,
  hasIssues,
  validationResults,
  domain,
  topics,
}: VotingDataPanelProps) {
  const trpc = useTRPC()

  const voteStats = useSuspenseQuery(
    trpc.voting.getSubmissionVoteStats.queryOptions({
      submissionId: submission.id,
      domain,
    }),
  ).data

  const votingSessionData = useSuspenseQuery(
    trpc.voting.getVotingSessionByParticipant.queryOptions({
      participantId: participant.id,
      topicId: submission.topicId,
      domain,
    }),
  ).data

  return (
    <SubmissionMetadataPanel
      submission={submission}
      topic={topic}
      participant={participant}
      hasIssues={hasIssues}
      validationResults={validationResults}
      marathonMode="by-camera"
      voteStats={voteStats}
      votingSessionData={votingSessionData}
      domain={domain}
      topics={topics}
    />
  )
}

export function ParticipantSubmissionClientPage({
  participantRef,
  submissionId,
}: {
  participantRef: string
  submissionId: number
}) {
  const domain = useDomain()

  const trpc = useTRPC()

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      domain,
      reference: participantRef,
    }),
  )

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  const submission = participant?.submissions.find((s) => s.id === submissionId)

  const topic = submission?.topic

  const submissionValidationResults =
    participant?.validationResults?.filter(
      (result) => result.fileName && submission?.key && result.fileName.includes(submission.key),
    ) || []

  const hasIssues = submissionValidationResults.some((result) => result.outcome === "failed")

  const allSubmissions = participant?.submissions
    .filter((s) => s.topic)
    .sort((a, b) => (a.topic?.orderIndex || 0) - (b.topic?.orderIndex || 0))

  const currentIndex = allSubmissions.findIndex((s) => s.id === submissionId)

  if (!submission || !topic || !participant) {
    notFound()
  }

  return (
    <div className="space-y-8 pb-10">
      <SubmissionHeader
        participant={participant}
        marathonMode={marathon.mode}
        hasIssues={hasIssues}
        submissionStatus={submission.status}
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="space-y-6">
          <div className="space-y-3">
            {marathon.mode !== "by-camera" && (
              <SubmissionNavigationControls
                currentIndex={currentIndex}
                totalSubmissions={allSubmissions.length}
                allSubmissions={allSubmissions}
                participantRef={participantRef}
              />
            )}
            <SubmissionImageViewer
              imageUrl={getImageUrl(submission)}
              topic={topic}
              competitionClass={participant.competitionClass}
              marathonMode={marathon?.mode}
              className="shadow-md"
            />
          </div>

          <SubmissionQuickActions
            marathonMode={marathon?.mode}
            participantId={participant.id}
            participantStatus={participant.status}
            participantRef={participantRef}
          />

          <SubmissionReviewTimeline
            submission={submission}
            participant={participant}
            hasIssues={hasIssues}
            marathonMode={marathon?.mode}
          />
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          {marathon.mode === "by-camera" ? (
            <Suspense
              fallback={
                <Card className="animate-pulse border p-6 shadow-sm">
                  <div className="mb-4 h-6 w-40 rounded bg-muted" />
                  <div className="h-36 rounded bg-muted" />
                </Card>
              }
            >
              <VotingDataPanel
                submission={submission}
                topic={topic}
                participant={participant}
                hasIssues={hasIssues}
                validationResults={submissionValidationResults}
                domain={domain}
                topics={marathon.topics}
              />
            </Suspense>
          ) : (
            <SubmissionMetadataPanel
              submission={submission}
              topic={topic}
              participant={participant}
              hasIssues={hasIssues}
              validationResults={submissionValidationResults}
              marathonMode={marathon.mode}
              voteStats={undefined}
              votingSessionData={undefined}
              domain={domain}
              topics={marathon.topics}
            />
          )}
        </div>
      </div>
    </div>
  )
}
