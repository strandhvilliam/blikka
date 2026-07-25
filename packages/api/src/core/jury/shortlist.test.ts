import { describe, expect, it } from 'vitest'

import {
  JURY_SHORTLIST_SIZE,
  getJuryShortlistWinnerId,
  getRequiredJuryShortlistSize,
  isJuryShortlistComplete,
} from './shortlist'

const makePicks = (count: number, winnerIndex: number | null = null) =>
  Array.from({ length: count }, (_, index) => ({
    participantId: index + 1,
    isWinner: index === winnerIndex,
  }))

describe('jury shortlist helpers', () => {
  it('caps the required size at the shortlist size', () => {
    expect(getRequiredJuryShortlistSize(50)).toBe(JURY_SHORTLIST_SIZE)
    expect(getRequiredJuryShortlistSize(JURY_SHORTLIST_SIZE)).toBe(JURY_SHORTLIST_SIZE)
  })

  it('shrinks the required size for scopes smaller than the shortlist', () => {
    expect(getRequiredJuryShortlistSize(4)).toBe(4)
    expect(getRequiredJuryShortlistSize(0)).toBe(0)
  })

  it('reads the winner out of the shortlist', () => {
    expect(getJuryShortlistWinnerId(makePicks(3, 1))).toBe(2)
    expect(getJuryShortlistWinnerId(makePicks(3))).toBe(null)
  })

  it('completes on a full shortlist with exactly one winner', () => {
    expect(
      isJuryShortlistComplete({
        picks: makePicks(JURY_SHORTLIST_SIZE, 0),
        requiredSize: JURY_SHORTLIST_SIZE,
      }),
    ).toBe(true)
  })

  it('rejects a full shortlist without a winner', () => {
    expect(
      isJuryShortlistComplete({
        picks: makePicks(JURY_SHORTLIST_SIZE),
        requiredSize: JURY_SHORTLIST_SIZE,
      }),
    ).toBe(false)
  })

  it('rejects an unfilled shortlist even when a winner is picked', () => {
    expect(
      isJuryShortlistComplete({
        picks: makePicks(JURY_SHORTLIST_SIZE - 1, 0),
        requiredSize: JURY_SHORTLIST_SIZE,
      }),
    ).toBe(false)
  })

  it('completes a small scope at its own required size', () => {
    expect(isJuryShortlistComplete({ picks: makePicks(3, 2), requiredSize: 3 })).toBe(true)
  })

  it('never completes an empty review set', () => {
    expect(isJuryShortlistComplete({ picks: [], requiredSize: 0 })).toBe(false)
  })

  it('rejects duplicate participants padding out the shortlist', () => {
    const picks = [
      { participantId: 1, isWinner: true },
      { participantId: 1, isWinner: false },
      { participantId: 2, isWinner: false },
    ]

    expect(isJuryShortlistComplete({ picks, requiredSize: 3 })).toBe(false)
  })
})
