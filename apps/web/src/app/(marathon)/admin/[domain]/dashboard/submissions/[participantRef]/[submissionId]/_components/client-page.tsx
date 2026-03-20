"use client"

import { notFound } from "next/navigation"
import { Suspense } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { SubmissionExifDataDisplay } from "./submission-exif-data-display"
import { SubmissionValidationSteps } from "./submission-validation-steps"
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
import { useState } from "react"
import { SubmissionQuickActions, type SubmissionDetailTab } from "./submission-quick-actions"
import { SubmissionReviewTimeline } from "./submission-review-timeline"
import { Card } from "@/components/ui/card"
import { useDomain } from "@/lib/domain-provider"
import {
  getSubmissionDownloadFileName,
  getSubmissionOriginalImageUrl,
  getSubmissionPreviewImageUrl,
} from "../_lib/submission-image-urls"

interface VotingDataPanelProps {
  submission: Submission
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
  const [detailTab, setDetailTab] = useState<SubmissionDetailTab>("exif")

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

  const previewImageUrl = getSubmissionPreviewImageUrl(submission)
  const originalImageUrl = getSubmissionOriginalImageUrl(submission)
  const submissionDownloadFileName = getSubmissionDownloadFileName(submission)
  const submissionDownloadUrl = originalImageUrl ?? previewImageUrl

  return (
    <div className="space-y-6">
      <SubmissionHeader participant={participant} marathonMode={marathon.mode} />

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
              imageUrl={previewImageUrl}
              originalImageUrl={originalImageUrl}
              downloadFileName={submissionDownloadFileName}
              topic={topic}
              competitionClass={participant.competitionClass}
              marathonMode={marathon?.mode}
            />
          </div>

          <SubmissionQuickActions
            submission={submission}
            validationResults={submissionValidationResults}
            activeDetailTab={detailTab}
            onDetailTabChange={setDetailTab}
            marathonMode={marathon?.mode}
            participantId={participant.id}
            participantStatus={participant.status}
            participantRef={participantRef}
            downloadUrl={submissionDownloadUrl}
            downloadFileName={submissionDownloadFileName}
          />

          <Card className="p-4" role="tabpanel">
            {detailTab === "validation" ? (
              <>
                <h3 className="font-gothic mb-3 text-base font-normal tracking-tight">
                  Validation Results
                </h3>
                <SubmissionValidationSteps validationResults={submissionValidationResults} />
              </>
            ) : (
              <>
                <h3 className="font-gothic mb-3 text-base font-normal tracking-tight">EXIF Data</h3>
                <SubmissionExifDataDisplay exifData={submission.exif || {}} />
              </>
            )}
          </Card>
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

          <SubmissionReviewTimeline
            submission={submission}
            participant={participant}
            marathonMode={marathon?.mode}
          />
        </div>
      </div>
    </div>
  )
}
