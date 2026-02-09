"use client"

import { notFound } from "next/navigation"
import { Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { SubmissionExifDataDisplay } from "./submission-exif-data-display"
import { SubmissionValidationSteps } from "./submission-validation-steps"
import { SubmissionHeader } from "./submission-header"
import type { Submission } from "@blikka/db"
import { SubmissionImageViewer } from "./submission-image-viewer"
import { SubmissionMetadataPanel } from "./submission-metadata-panel"
import { SubmissionNavigationControls } from "./submission-navigation-controls"
import { useState } from "react"
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
  participant: any
  hasIssues: boolean
  validationResults: any[]
  domain: string
  topics: any[]
}

function VotingDataPanel({
  submission,
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
  const [showExifPanel, setShowExifPanel] = useState(false)
  const [showValidationPanel, setShowValidationPanel] = useState(false)

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

  console.log({ submission })

  const topic = submission?.topic

  const submissionValidationResults =
    participant?.validationResults?.filter(
      (result) =>
        result.fileName &&
        submission?.key &&
        result.fileName.includes(submission.key),
    ) || []

  const hasIssues = submissionValidationResults.some(
    (result) => result.outcome === "failed",
  )

  const allSubmissions = participant?.submissions
    .filter((s) => s.topic)
    .sort((a, b) => (a.topic?.orderIndex || 0) - (b.topic?.orderIndex || 0))

  const currentIndex = allSubmissions.findIndex(
    (s) => s.id === submissionId,
  )

  if (!submission || !topic || !participant) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <SubmissionHeader
        participant={participant}
        marathonMode={marathon.mode}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
        <div className="space-y-6">
          <div className="relative">
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
            />
          </div>

          <SubmissionQuickActions
            submission={submission}
            validationResults={submissionValidationResults}
            onShowExif={() => setShowExifPanel(!showExifPanel)}
            onShowValidation={() =>
              setShowValidationPanel(!showValidationPanel)
            }
            showExifPanel={showExifPanel}
            showValidationPanel={showValidationPanel}
            marathonMode={marathon?.mode}
            participantId={participant.id}
            participantStatus={participant.status}
            participantRef={participantRef}
          />

          {showValidationPanel && (
            <Card className="p-4">
              <h3 className="text-base font-semibold font-rocgrotesk mb-3">
                Validation Results
              </h3>
              <SubmissionValidationSteps
                validationResults={submissionValidationResults}
              />
            </Card>
          )}

          {showExifPanel && (
            <Card className="p-4">
              <h3 className="text-base font-semibold font-rocgrotesk mb-3">
                EXIF Data
              </h3>
              <SubmissionExifDataDisplay exifData={submission.exif} />
            </Card>
          )}

          <SubmissionReviewTimeline
            submission={submission}
            participant={participant}
            hasIssues={hasIssues}
            marathonMode={marathon?.mode}
          />
        </div>

        <div className="space-y-6">
          {marathon.mode === "by-camera" ? (
            <Suspense
              fallback={
                <Card className="p-4 animate-pulse">
                  <div className="h-32 bg-muted rounded" />
                </Card>
              }
            >
              <VotingDataPanel
                submission={submission}
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
