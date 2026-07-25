'use client'

import { type ChangeEvent, useCallback, useEffect, useRef } from 'react'

const DEBOUNCE_MS = 800

export function useJuryNotesDebouncedSave({
  localRating,
  saveRating,
  setLocalNotes,
}: {
  localRating: number
  saveRating: (nextRating: number, nextNotes: string) => void | Promise<void>
  setLocalNotes: (notes: string) => void
}) {
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current)
      }
    }
  }, [])

  const handleNotesChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextNotes = event.target.value
      setLocalNotes(nextNotes)

      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current)
      }

      notesTimeoutRef.current = setTimeout(() => {
        void saveRating(localRating, nextNotes)
      }, DEBOUNCE_MS)
    },
    [localRating, saveRating, setLocalNotes],
  )

  return { handleNotesChange }
}
