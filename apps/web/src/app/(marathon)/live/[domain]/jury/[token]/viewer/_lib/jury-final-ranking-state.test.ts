import { describe, expect, it } from "vitest";

import {
  getAssignedFinalRankingCount,
  getFinalRankingLabel,
  getParticipantFinalRanking,
  hasCompleteFinalRankings,
} from "./jury-final-ranking-state";

const ratings = [
  { participantId: 1, rating: 5, notes: "", finalRanking: 1 },
  { participantId: 2, rating: 4, notes: "", finalRanking: 2 },
  { participantId: 3, rating: 3, notes: "", finalRanking: null },
] as const;

describe("jury final ranking state", () => {
  it("counts assigned podium slots", () => {
    expect(getAssignedFinalRankingCount(ratings)).toBe(2);
    expect(hasCompleteFinalRankings(ratings)).toBe(false);
  });

  it("reads a participant podium assignment", () => {
    expect(getParticipantFinalRanking(ratings, 1)).toBe(1);
    expect(getParticipantFinalRanking(ratings, 3)).toBe(null);
  });

  it("formats podium labels", () => {
    expect(getFinalRankingLabel(1)).toBe("1st");
    expect(getFinalRankingLabel(2)).toBe("2nd");
    expect(getFinalRankingLabel(3)).toBe("3rd");
  });
});
