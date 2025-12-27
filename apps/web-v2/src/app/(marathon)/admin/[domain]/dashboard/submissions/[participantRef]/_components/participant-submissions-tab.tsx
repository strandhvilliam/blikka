"use client"

import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useParams } from "next/navigation"
import { AnimatePresence } from "motion/react"
import { ParticipantSubmissionCard } from "./participant-submission-card"

export function ParticipantSubmissionsTab() {
  const { domain, participantRef } = useParams<{ domain: string; participantRef: string }>()
  const trpc = useTRPC()

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    })
  )

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    })
  )

  const data = participant?.submissions
    .map((s) => ({
      submission: s,
      topic: marathon?.topics.find((t) => t.id === s.topicId),
    }))
    .sort((a, b) => (a.topic?.orderIndex ?? 0) - (b.topic?.orderIndex ?? 0))

  const validationResults = participant?.validationResults || []

  if (!data || !participant) {
    return <div>Participant not found</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <AnimatePresence>
        {data.map(({ submission, topic }) => (
          <ParticipantSubmissionCard
            key={submission.id}
            submission={submission}
            topic={topic}
            validationResults={validationResults}
          />
        ))}
        {data.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No photos submitted yet
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
