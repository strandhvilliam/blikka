"use client"

import { notFound } from "next/navigation"
import { Suspense, useEffect } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { SubmissionExifDataDisplay } from "./submission-exif-data-display"
import { SubmissionValidationSteps } from "./submission-validation-steps"
import { SubmissionHeader } from "./submission-header"
import type {
  Participant,
  Submission,
  ValidationResult,
  CompetitionClass,
  DeviceGroup,
} from "@blikka/db"
import { SubmissionImageViewer } from "./submission-image-viewer"
import { SubmissionMetadataPanel } from "./submission-metadata-panel"
import { SubmissionNavigationControls } from "./submission-navigation-controls"
import { useState } from "react"
import { SubmissionQuickActions, type SubmissionDetailTab } from "./submission-quick-actions"
import { SubmissionReviewTimeline } from "./submission-review-timeline"
import { useRouter } from "next/navigation"

import { useDomain } from "@/lib/domain-provider"
import { formatDomainPathname } from "@/lib/utils"
import { getVotingLifecycleState } from "@/lib/voting-lifecycle"
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
}

function VotingDataPanel({
  submission,
  participant,
  hasIssues,
  validationResults,
  domain,
}: VotingDataPanelProps) {
  const trpc = useTRPC()

  const voteStats = useSuspenseQuery(
    trpc.voting.getSubmissionVoteStats.queryOptions({
      submissionId: submission.id,
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
      domain={domain}
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
  const router = useRouter()

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
  const latestSubmission =
    participant?.submissions
      .filter((candidate) => candidate.topic)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )[0] ?? null

  useEffect(() => {
    if (
      marathon.mode !== "by-camera" ||
      !participant ||
      submission ||
      !latestSubmission
    ) {
      return
    }

    router.replace(
      formatDomainPathname(
        `/admin/dashboard/submissions/${participant.reference}/${latestSubmission.id}`,
        domain,
      ),
    )
  }, [domain, latestSubmission, marathon.mode, participant, router, submission])

  if (marathon.mode === "by-camera" && participant && !submission && latestSubmission) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground">
        Syncing to the latest submission...
      </div>
    )
  }

  if (!submission || !topic || !participant) {
    notFound()
  }

  const previewImageUrl = getSubmissionPreviewImageUrl(submission)
  const originalImageUrl = getSubmissionOriginalImageUrl(submission)
  const submissionDownloadFileName = getSubmissionDownloadFileName(submission)
  const submissionDownloadUrl = originalImageUrl ?? previewImageUrl

  const byCameraVotingStarted =
    marathon.mode === "by-camera" &&
    getVotingLifecycleState({
      startsAt: topic.votingStartsAt,
      endsAt: topic.votingEndsAt,
    }) !== "not-started"

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

          <div className="rounded-xl border border-border bg-white p-4" role="tabpanel">
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
          </div>
        </div>

        <div className="space-y-6">
          {marathon.mode === "by-camera" ? (
            byCameraVotingStarted ? (
              <Suspense
                fallback={
                  <div className="rounded-xl border border-border bg-white p-4 animate-pulse">
                    <div className="h-32 bg-muted/30 rounded-lg" />
                  </div>
                }
              >
                <VotingDataPanel
                  submission={submission}
                  participant={participant}
                  hasIssues={hasIssues}
                  validationResults={submissionValidationResults}
                  domain={domain}
                />
              </Suspense>
            ) : (
              <SubmissionMetadataPanel
                submission={submission}
                participant={participant}
                hasIssues={hasIssues}
                validationResults={submissionValidationResults}
                marathonMode="by-camera"
                voteStats={undefined}
                domain={domain}
              />
            )
          ) : (
            <SubmissionMetadataPanel
              submission={submission}
              participant={participant}
              hasIssues={hasIssues}
              validationResults={submissionValidationResults}
              marathonMode={marathon.mode}
              voteStats={undefined}
              domain={domain}
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
