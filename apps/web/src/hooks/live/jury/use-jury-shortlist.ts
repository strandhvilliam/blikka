'use client'

import { useCallback, useMemo } from 'react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'
import { getShortlistedParticipantIds, sortShortlistForDisplay } from '@/lib/jury/jury-utils'

/** One id for every pick toast, so holding down S or W never stacks a column of them. */
const PICK_TOAST_ID = 'jury-shortlist-pick'

function formatShortlistProgress(state: {
  picks: ReadonlyArray<unknown>
  requiredSize: number
  isComplete: boolean
}): string {
  const progress = `${state.picks.length} of ${state.requiredSize} shortlisted`
  return state.isComplete ? `${progress} — you can submit your review` : progress
}

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

  /** A removed pick is gone from the response, so callers pass the reference they already render. */
  const labelFor = useCallback(
    (participantId: number, reference?: string) => {
      const resolved =
        reference ?? shortlist.picks.find((pick) => pick.participantId === participantId)?.reference
      return resolved ? `#${resolved}` : 'Submission'
    },
    [shortlist.picks],
  )

  /** The raw writes: they only report failures, so composed actions land on a single toast. */
  const runSetPick = useCallback(
    async (participantId: number, selected: boolean) => {
      try {
        return await setPickMutation.mutateAsync({ domain, token, participantId, selected })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update your shortlist')
        return null
      }
    },
    [domain, setPickMutation, token],
  )

  const runSetWinner = useCallback(
    async (participantId: number | null) => {
      try {
        return await setWinnerMutation.mutateAsync({ domain, token, participantId })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update your winner')
        return null
      }
    },
    [domain, setWinnerMutation, token],
  )

  /** Resolves `false` when the write was rejected, so callers can abort a follow-up step. */
  const setPick = useCallback(
    async (participantId: number, selected: boolean, reference?: string) => {
      const label = labelFor(participantId, reference)
      const next = await runSetPick(participantId, selected)
      if (!next) return false

      toast.success(selected ? `${label} shortlisted` : `${label} removed from your shortlist`, {
        id: PICK_TOAST_ID,
        description: formatShortlistProgress(next),
      })
      return true
    },
    [labelFor, runSetPick],
  )

  /** `reference` names the outgoing winner when clearing, and the incoming one otherwise. */
  const setWinner = useCallback(
    async (participantId: number | null, reference?: string) => {
      const label = participantId === null ? null : labelFor(participantId, reference)
      const next = await runSetWinner(participantId)
      if (!next) return false

      if (participantId === null) {
        toast.success('Winner removed', {
          id: PICK_TOAST_ID,
          description: reference
            ? `#${reference} stays on your shortlist`
            : formatShortlistProgress(next),
        })
        return true
      }

      toast.success(`${label} is your winner`, {
        id: PICK_TOAST_ID,
        description: formatShortlistProgress(next),
      })
      return true
    },
    [labelFor, runSetWinner],
  )

  /** Shortlists the submission first when needed — the winner must sit on the shortlist. */
  const pickWinner = useCallback(
    async (participantId: number, reference?: string) => {
      const label = labelFor(participantId, reference)
      const wasShortlisted = shortlistedIds.has(participantId)

      if (!wasShortlisted && !(await runSetPick(participantId, true))) {
        return false
      }

      const next = await runSetWinner(participantId)
      if (!next) return false

      toast.success(`${label} is your winner`, {
        id: PICK_TOAST_ID,
        description: wasShortlisted
          ? formatShortlistProgress(next)
          : `Added to your shortlist · ${formatShortlistProgress(next)}`,
      })
      return true
    },
    [labelFor, runSetPick, runSetWinner, shortlistedIds],
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
