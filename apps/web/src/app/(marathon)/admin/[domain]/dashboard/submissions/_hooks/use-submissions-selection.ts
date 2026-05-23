'use client'

import { useCallback, useMemo, useState } from 'react'
import { buildParticipantIndexes } from '../_lib/submissions-utils'
import type { SubmissionTableRow } from '../_lib/submissions-types'

export function useSubmissionsSelection(participants: SubmissionTableRow[]) {
  const { participantIds, participantIndexById, participantsById } = useMemo(
    () => buildParticipantIndexes(participants),
    [participants],
  )

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null)

  const selectedCount = selectedIds.size
  const hasSelection = selectedCount > 0

  const toggleSelection = useCallback(
    (id: number, event: React.MouseEvent) => {
      setSelectedIds((previousSelection) => {
        const nextSelection = new Set(previousSelection)

        if (event.shiftKey && lastSelectedId !== null) {
          const lastIndex = participantIndexById.get(lastSelectedId)
          const currentIndex = participantIndexById.get(id)

          if (lastIndex !== undefined && currentIndex !== undefined) {
            const start = Math.min(lastIndex, currentIndex)
            const end = Math.max(lastIndex, currentIndex)

            for (let index = start; index <= end; index++) {
              const participantId = participantIds[index]
              if (participantId !== undefined) {
                nextSelection.add(participantId)
              }
            }
          }

          return nextSelection
        }

        if (nextSelection.has(id)) {
          nextSelection.delete(id)
        } else {
          nextSelection.add(id)
        }

        return nextSelection
      })

      if (!event.shiftKey) {
        setLastSelectedId(id)
      }
    },
    [lastSelectedId, participantIds, participantIndexById],
  )

  const isSelected = useCallback((id: number) => selectedIds.has(id), [selectedIds])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }, [])

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((previousSelection) => {
      const allVisibleSelected = participantIds.every((id) => previousSelection.has(id))
      const nextSelection = new Set(previousSelection)

      for (const id of participantIds) {
        if (allVisibleSelected) {
          nextSelection.delete(id)
        } else {
          nextSelection.add(id)
        }
      }

      return nextSelection
    })
  }, [participantIds])

  const canVerifySelected = useMemo(() => {
    if (selectedIds.size === 0) return false

    for (const id of selectedIds) {
      if (participantsById.get(id)?.status !== 'completed') {
        return false
      }
    }

    return true
  }, [participantsById, selectedIds])

  return {
    selectedIds,
    selectedCount,
    hasSelection,
    toggleSelection,
    toggleAllVisible,
    isSelected,
    clearSelection,
    canVerifySelected,
  }
}
