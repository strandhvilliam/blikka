"use client"

import { useMemo } from "react"
import {
  resolveJuryReviewParticipantIndex,
  useJuryReviewQueryState,
} from "../_hooks/use-jury-review-query-state"
import {
  JuryReviewDataProvider,
  useJuryReviewData,
} from "./jury-review-data-provider"
import { JuryParticipantList } from "./jury-participant-list"
import { JuryReviewHeader } from "./jury-review-header"
import { JurySubmissionViewer } from "./jury-submission-viewer"

export type { ViewMode } from "../_lib/jury-view-mode"

export function JuryReviewClient() {
  return (
    <JuryReviewDataProvider>
      <JuryReviewClientContent />
    </JuryReviewDataProvider>
  )
}

function JuryReviewClientContent() {
  const {
    participants,
    isFetching,
    isFetchingNextPage,
    isFetchingParticipantCount,
  } = useJuryReviewData()
  const { selectedParticipantId, currentParticipantIndex } =
    useJuryReviewQueryState()

  const selectedIndex = useMemo(
    () =>
      resolveJuryReviewParticipantIndex(
        participants,
        selectedParticipantId,
        currentParticipantIndex,
      ),
    [currentParticipantIndex, participants, selectedParticipantId],
  )

  const isRefreshingResults =
    isFetchingParticipantCount || (isFetching && !isFetchingNextPage)
  const shouldShowViewer =
    selectedParticipantId !== null && participants.length > 0

  return (
    <main className="min-h-dvh bg-neutral-50 bg-dot-pattern-light">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <JuryReviewHeader />

        {shouldShowViewer ? (
          <JurySubmissionViewer initialIndex={selectedIndex} />
        ) : (
          <JuryParticipantList isRefreshingResults={isRefreshingResults} />
        )}
      </div>
    </main>
  )
}
