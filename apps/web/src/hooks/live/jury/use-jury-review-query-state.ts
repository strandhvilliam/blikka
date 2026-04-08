"use client"

import { useTransition } from "react"
import { parseAsArrayOf, parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs"

export function useJuryReviewQueryState() {
  const [, startFilterTransition] = useTransition()
  const [selectedParticipantId, setSelectedParticipantId] = useQueryState(
    "participant",
    parseAsInteger,
  )
  const [currentParticipantIndex, setCurrentParticipantIndex] = useQueryState(
    "index",
    parseAsInteger.withDefault(0),
  )
  const [selectedRatings, setSelectedRatings] = useQueryState(
    "ratings",
    parseAsArrayOf(parseAsInteger).withDefault([]),
  )
  const [viewMode, setViewMode] = useQueryState(
    "view",
    parseAsStringLiteral(["compact", "grid"] as const).withDefault("grid"),
  )

  const clearRatingFilter = () => {
    startFilterTransition(() => {
      void setSelectedParticipantId(null)
      void setCurrentParticipantIndex(0)
      void setSelectedRatings([])
    })
  }

  const toggleRatingFilter = (rating: number) => {
    startFilterTransition(() => {
      void setSelectedParticipantId(null)
      void setCurrentParticipantIndex(0)
      void setSelectedRatings((previous) => {
        const nextRatings = previous.includes(rating) ? [] : [rating]
        return nextRatings.toSorted((left, right) => left - right)
      })
    })
  }

  const selectParticipant = (participantId: number, index: number) => {
    void setCurrentParticipantIndex(index)
    void setSelectedParticipantId(participantId)
  }

  const backToList = () => {
    void setSelectedParticipantId(null)
    void setCurrentParticipantIndex(0)
  }

  return {
    selectedParticipantId,
    setSelectedParticipantId,
    currentParticipantIndex,
    setCurrentParticipantIndex,
    selectedRatings,
    setSelectedRatings,
    viewMode,
    setViewMode,
    clearRatingFilter,
    toggleRatingFilter,
    selectParticipant,
    backToList,
  }
}

/** Pure: list index from URL state + loaded participants. */
export function resolveJuryReviewParticipantIndex(
  participants: readonly { id: number }[],
  selectedParticipantId: number | null,
  currentParticipantIndex: number,
) {
  if (selectedParticipantId === null) {
    return currentParticipantIndex
  }

  const index = participants.findIndex((participant) => participant.id === selectedParticipantId)
  return index >= 0 ? index : 0
}
