"use client"

import { notFound } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useParams } from "next/navigation"
import { SubmissionExifDataDisplay } from "./submission-exif-data-display"
import { SubmissionValidationSteps } from "./submission-validation-steps"
import { SubmissionDetails } from "./submission-details"
import { SubmissionHeader } from "./submission-header"
import { SubmissionPreviewCard } from "./submission-preview-card"
import { Submission } from "@blikka/db"

const AWS_S3_BASE_URL = "https://s3.eu-north-1.amazonaws.com"

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

export function ParticipantTopicSubmissionClientPage() {
  const { domain, participantRef, topicOrderIndex } = useParams<{
    domain: string
    participantRef: string
    topicOrderIndex: string
  }>()
  const trpc = useTRPC()

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      domain,
      reference: participantRef,
    })
  )

  const submission = participant?.submissions.find(
    (s) => s.topic?.orderIndex === parseInt(topicOrderIndex)
  )

  const topic = submission?.topic

  const submissionValidationResults =
    participant?.validationResults?.filter(
      (result) => result.fileName && submission?.key && result.fileName.includes(submission.key)
    ) || []

  const hasIssues = submissionValidationResults.some((result) => result.outcome === "failed")

  if (!submission || !topic || !participant) {
    notFound()
  }

  return (
    <>
      <SubmissionHeader
        submission={submission}
        participant={participant}
        topic={topic}
        validationResults={submissionValidationResults}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        <div>
          <Tabs defaultValue="details" className="">
            <TabsList className="bg-background rounded-none p-0 h-auto border-b border-muted-foreground/25 w-full flex justify-start">
              <TabsTrigger
                value="details"
                className="px-4 py-2 bg-background rounded-none data-[state=active]:shadow-none data-[state=active]:border-primary border-b-2 border-transparent"
              >
                Details & Timeline
              </TabsTrigger>
              <TabsTrigger
                value="validation"
                className="px-4 py-2 bg-background rounded-none data-[state=active]:shadow-none data-[state=active]:border-primary border-b-2 border-transparent"
              >
                Validation Results
              </TabsTrigger>
              <TabsTrigger
                value="exif"
                className="px-4 py-2 bg-background rounded-none data-[state=active]:shadow-none data-[state=active]:border-primary border-b-2 border-transparent"
              >
                EXIF Data
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <SubmissionDetails
                submission={submission}
                topic={topic}
                participant={participant}
                hasIssues={hasIssues}
              />
            </TabsContent>

            <TabsContent value="validation" className="mt-4">
              <SubmissionValidationSteps validationResults={submissionValidationResults} />
            </TabsContent>

            <TabsContent value="exif" className="mt-4 space-y-4">
              <SubmissionExifDataDisplay exifData={submission.exif} />
            </TabsContent>
          </Tabs>
        </div>
        <SubmissionPreviewCard
          competitionClass={participant.competitionClass}
          topic={topic}
          imageUrl={getImageUrl(submission)}
        />
      </div>
    </>
  )
}
