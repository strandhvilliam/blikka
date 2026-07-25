/**
 * A juror shortlists their favorite submissions for the topic or class they review — an unordered
 * set, not a ranking — and then picks a single winner out of that shortlist.
 */
export const JURY_SHORTLIST_SIZE = 10

export interface JuryShortlistPickLike {
  participantId: number
  isWinner: boolean
}

/** Scopes smaller than the shortlist cannot fill it, so the target shrinks to the reviewable set. */
export function getRequiredJuryShortlistSize(participantsInScope: number): number {
  return Math.max(0, Math.min(JURY_SHORTLIST_SIZE, participantsInScope))
}

export function getJuryShortlistWinnerId(
  picks: ReadonlyArray<JuryShortlistPickLike>,
): number | null {
  return picks.find((pick) => pick.isWinner)?.participantId ?? null
}

/** A review may be submitted once the shortlist is filled and exactly one pick carries the win. */
export function isJuryShortlistComplete({
  picks,
  requiredSize,
}: {
  picks: ReadonlyArray<JuryShortlistPickLike>
  requiredSize: number
}): boolean {
  if (requiredSize <= 0) {
    return false
  }

  const participantIds = new Set(picks.map((pick) => pick.participantId))
  if (participantIds.size !== requiredSize) {
    return false
  }

  return picks.filter((pick) => pick.isWinner).length === 1
}
