import { describe, expect, it } from "vitest";

import {
  hasCompleteJuryTopThree,
  isValidJuryFinalRanking,
} from "./final-rankings";

describe("jury final ranking helpers", () => {
  it("accepts only null or rankings one through three", () => {
    expect(isValidJuryFinalRanking(undefined)).toBe(true);
    expect(isValidJuryFinalRanking(null)).toBe(true);
    expect(isValidJuryFinalRanking(1)).toBe(true);
    expect(isValidJuryFinalRanking(2)).toBe(true);
    expect(isValidJuryFinalRanking(3)).toBe(true);
    expect(isValidJuryFinalRanking(0)).toBe(false);
    expect(isValidJuryFinalRanking(4)).toBe(false);
  });

  it("detects a complete podium of three distinct participants", () => {
    expect(
      hasCompleteJuryTopThree([
        { participantId: 11, finalRanking: 1 },
        { participantId: 22, finalRanking: 2 },
        { participantId: 33, finalRanking: 3 },
      ]),
    ).toBe(true);
  });

  it("rejects missing or duplicate podium slots", () => {
    expect(
      hasCompleteJuryTopThree([
        { participantId: 11, finalRanking: 1 },
        { participantId: 22, finalRanking: 2 },
      ]),
    ).toBe(false);

    expect(
      hasCompleteJuryTopThree([
        { participantId: 11, finalRanking: 1 },
        { participantId: 11, finalRanking: 2 },
        { participantId: 33, finalRanking: 3 },
      ]),
    ).toBe(false);
  });
});
