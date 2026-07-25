'use client'

import type { JuryRatingEntry } from '@/lib/jury/jury-types'
import { useRef, useState } from 'react'

type ServerSnapshot = {
  participantId: number | null
  rating: number
  notes: string
}

export function useJuryLocalRatingSync({
  existingRating,
  currentParticipantId,
}: {
  existingRating: JuryRatingEntry | undefined
  currentParticipantId: number | null
}) {
  const serverSnapshot: ServerSnapshot = {
    participantId: currentParticipantId,
    rating: existingRating?.rating ?? 0,
    notes: existingRating?.notes ?? '',
  }

  const [localRating, setLocalRating] = useState(serverSnapshot.rating)
  const [localNotes, setLocalNotes] = useState(serverSnapshot.notes)

  const lastServerSnapshot = useRef<ServerSnapshot | null>(null)
  if (lastServerSnapshot.current === null) {
    lastServerSnapshot.current = serverSnapshot
  } else {
    const prev = lastServerSnapshot.current
    if (
      prev.participantId !== serverSnapshot.participantId ||
      prev.rating !== serverSnapshot.rating ||
      prev.notes !== serverSnapshot.notes
    ) {
      lastServerSnapshot.current = serverSnapshot
      setLocalRating(serverSnapshot.rating)
      setLocalNotes(serverSnapshot.notes)
    }
  }

  return {
    localRating,
    setLocalRating,
    localNotes,
    setLocalNotes,
  }
}
