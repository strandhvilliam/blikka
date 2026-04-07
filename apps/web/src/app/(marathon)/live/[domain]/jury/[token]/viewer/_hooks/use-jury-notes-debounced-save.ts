import { type ChangeEvent, useCallback, useEffect, useRef } from "react"

const DEBOUNCE_MS = 800

export function useJuryNotesDebouncedSave({
  localRating,
  localFinalRanking,
  saveRating,
  setLocalNotes,
}: {
  localRating: number
  localFinalRanking: 1 | 2 | 3 | null
  saveRating: (
    nextRating: number,
    nextNotes: string,
    nextFinalRanking: 1 | 2 | 3 | null,
  ) => void | Promise<void>
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
        void saveRating(localRating, nextNotes, localFinalRanking)
      }, DEBOUNCE_MS)
    },
    [localFinalRanking, localRating, saveRating, setLocalNotes],
  )

  return { handleNotesChange }
}
