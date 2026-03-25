import type { JuryRatingsResponse } from "../../_lib/jury-types";

export type JuryRatingEntry = JuryRatingsResponse["ratings"][number];

export function getAssignedFinalRankingCount(
  ratings: ReadonlyArray<JuryRatingEntry>,
): number {
  return new Set(
    ratings
      .map((rating) => rating.finalRanking)
      .filter(
        (finalRanking): finalRanking is 1 | 2 | 3 =>
          finalRanking === 1 || finalRanking === 2 || finalRanking === 3,
      ),
  ).size;
}

export function hasCompleteFinalRankings(
  ratings: ReadonlyArray<JuryRatingEntry>,
): boolean {
  return getAssignedFinalRankingCount(ratings) === 3;
}

export function getParticipantFinalRanking(
  ratings: ReadonlyArray<JuryRatingEntry>,
  participantId: number,
): 1 | 2 | 3 | null {
  const entry = ratings.find(
    (rating) => rating.participantId === participantId,
  );
  const finalRanking = entry?.finalRanking;

  return finalRanking === 1 || finalRanking === 2 || finalRanking === 3
    ? finalRanking
    : null;
}

export function getFinalRankingLabel(finalRanking: 1 | 2 | 3): string {
  switch (finalRanking) {
    case 1:
      return "1st";
    case 2:
      return "2nd";
    case 3:
      return "3rd";
  }
}

export function getRankAssignments(
  ratings: ReadonlyArray<JuryRatingEntry>,
): Map<1 | 2 | 3, number> {
  const assignments = new Map<1 | 2 | 3, number>();
  for (const rating of ratings) {
    if (
      rating.finalRanking === 1 ||
      rating.finalRanking === 2 ||
      rating.finalRanking === 3
    ) {
      assignments.set(rating.finalRanking, rating.participantId);
    }
  }
  return assignments;
}
