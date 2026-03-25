export type JuryFinalRankingValue = 1 | 2 | 3;

export interface JuryFinalRankingLike {
  participantId: number;
  finalRanking?: number | null;
  rank?: number | null;
}

export function isValidJuryFinalRanking(
  finalRanking: number | null | undefined,
): finalRanking is JuryFinalRankingValue | null {
  return (
    finalRanking === null ||
    finalRanking === undefined ||
    finalRanking === 1 ||
    finalRanking === 2 ||
    finalRanking === 3
  );
}

export function hasCompleteJuryTopThree(
  ratings: ReadonlyArray<JuryFinalRankingLike>,
): boolean {
  const rankedParticipantIds = new Map<JuryFinalRankingValue, number>();

  for (const rating of ratings) {
    const finalRanking = rating.finalRanking ?? rating.rank ?? null;
    if (finalRanking === 1 || finalRanking === 2 || finalRanking === 3) {
      rankedParticipantIds.set(finalRanking, rating.participantId);
    }
  }

  if (rankedParticipantIds.size !== 3) {
    return false;
  }

  return new Set(rankedParticipantIds.values()).size === 3;
}
