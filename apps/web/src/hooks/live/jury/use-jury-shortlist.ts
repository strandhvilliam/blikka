'use client'

import { useCallback, useMemo } from 'react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'
import { getShortlistedParticipantIds, sortShortlistForDisplay } from '@/lib/jury/jury-utils'

/**
 * The juror's shortlist and the two writes against it. Every mutation returns the whole shortlist,
 * so header, list, and viewer stay in step off a single cache entry.
 */
export function useJuryShortlist({ domain, token }: { domain: string; token: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: shortlist } = useSuspenseQuery(
    trpc.jury.getJuryShortlist.queryOptions({ domain, token }),
  )

  const invalidateJury = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: trpc.jury.pathKey() })
  }, [queryClient, trpc.jury])

  const setPickMutation = useMutation(
    trpc.jury.setShortlistPick.mutationOptions({ onSettled: invalidateJury }),
  )
  const setWinnerMutation = useMutation(
    trpc.jury.setShortlistWinner.mutationOptions({ onSettled: invalidateJury }),
  )

  const shortlistedIds = useMemo(
    () => getShortlistedParticipantIds(shortlist.picks),
    [shortlist.picks],
  )
  const orderedPicks = useMemo(() => sortShortlistForDisplay(shortlist.picks), [shortlist.picks])

  /** Resolves `false` when the write was rejected, so callers can abort a follow-up step. */
  const setPick = useCallback(
    async (participantId: number, selected: boolean) => {
      try {
        await setPickMutation.mutateAsync({ domain, token, participantId, selected })
        return true
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update your shortlist')
        return false
      }
    },
    [domain, setPickMutation, token],
  )

  const setWinner = useCallback(
    async (participantId: number | null) => {
      try {
        await setWinnerMutation.mutateAsync({ domain, token, participantId })
        return true
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update your winner')
        return false
      }
    },
    [domain, setWinnerMutation, token],
  )

  /** Shortlists the submission first when needed — the winner must sit on the shortlist. */
  const pickWinner = useCallback(
    async (participantId: number) => {
      if (!shortlistedIds.has(participantId) && !(await setPick(participantId, true))) {
        return false
      }

      return setWinner(participantId)
    },
    [setPick, setWinner, shortlistedIds],
  )

  return {
    picks: orderedPicks,
    shortlistedIds,
    winnerParticipantId: shortlist.winnerParticipantId,
    count: shortlist.picks.length,
    maxSize: shortlist.maxSize,
    requiredSize: shortlist.requiredSize,
    isComplete: shortlist.isComplete,
    isFull: shortlist.picks.length >= shortlist.maxSize,
    isSaving: setPickMutation.isPending || setWinnerMutation.isPending,
    setPick,
    setWinner,
    pickWinner,
  }
}
