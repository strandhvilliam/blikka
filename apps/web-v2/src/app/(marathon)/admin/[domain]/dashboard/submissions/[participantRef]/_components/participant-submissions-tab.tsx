"use client"

import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useParams, usePathname } from "next/navigation"
import { AnimatePresence } from "motion/react"
import { ParticipantSubmissionCard } from "./participant-submission-card"
import { cn } from "@/lib/utils"
import { useDomain } from "@/lib/domain-provider"

export function ParticipantSubmissionsTab({ participantRef }: { participantRef: string }) {
  const { domain } = useDomain()

  const trpc = useTRPC()

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    })
  )

  const data = participant?.submissions
    .map((s) => ({
      submission: s,
      validationResults:
        participant?.validationResults?.filter(
          (result) => result.fileName && result.fileName.includes(s.key)
        ) || [],
    }))
    .sort((a, b) => (a.submission.topic?.orderIndex ?? 0) - (b.submission.topic?.orderIndex ?? 0))

  if (!data || !participant) {
    return <div>Participant not found</div>
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4",
        data.length < 12 ? "xl:grid-cols-4" : "xl:grid-cols-6"
      )}
    >
      <AnimatePresence>
        {data.map(({ submission, validationResults }) => (
          <ParticipantSubmissionCard
            key={submission.id}
            submission={submission}
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
