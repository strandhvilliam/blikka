"use client"

import { getParticipantFinalRanking } from "@/lib/jury/jury-utils"
import type { JuryRatingEntry } from "@/lib/jury/jury-types"
import { useRef, useState } from "react"

type ServerSnapshot = {
  participantId: number | null
  rating: number
  notes: string
  finalRanking: 1 | 2 | 3 | null
}

export function useJuryLocalRatingSync({
  existingRating,
  ratings,
  currentParticipantId,
}: {
  existingRating: JuryRatingEntry | undefined
  ratings: ReadonlyArray<JuryRatingEntry>
  currentParticipantId: number | null
}) {
  const serverSnapshot: ServerSnapshot = {
    participantId: currentParticipantId,
    rating: existingRating?.rating ?? 0,
    notes: existingRating?.notes ?? "",
    finalRanking: getParticipantFinalRanking(ratings, currentParticipantId ?? -1),
  }

  const [localRating, setLocalRating] = useState(serverSnapshot.rating)
  const [localNotes, setLocalNotes] = useState(serverSnapshot.notes)
  const [localFinalRanking, setLocalFinalRanking] = useState<1 | 2 | 3 | null>(
    serverSnapshot.finalRanking,
  )

  const lastServerSnapshot = useRef<ServerSnapshot | null>(null)
  if (lastServerSnapshot.current === null) {
    lastServerSnapshot.current = serverSnapshot
  } else {
    const prev = lastServerSnapshot.current
    if (
      prev.participantId !== serverSnapshot.participantId ||
      prev.rating !== serverSnapshot.rating ||
      prev.notes !== serverSnapshot.notes ||
      prev.finalRanking !== serverSnapshot.finalRanking
    ) {
      lastServerSnapshot.current = serverSnapshot
      setLocalRating(serverSnapshot.rating)
      setLocalNotes(serverSnapshot.notes)
      setLocalFinalRanking(serverSnapshot.finalRanking)
    }
  }

  return {
    localRating,
    setLocalRating,
    localNotes,
    setLocalNotes,
    localFinalRanking,
    setLocalFinalRanking,
  }
}
