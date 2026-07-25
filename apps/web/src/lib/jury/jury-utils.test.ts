import { describe, expect, it } from 'vitest'

import {
  compareParticipantReferences,
  getDisplayInitials,
  getShortlistedParticipantIds,
  sortShortlistForDisplay,
} from './jury-utils'

const picks = [
  { participantId: 3, reference: '10', isWinner: false },
  { participantId: 1, reference: '2', isWinner: true },
  { participantId: 2, reference: '9', isWinner: false },
] as const

describe('jury shortlist state', () => {
  it('collects shortlisted participant ids', () => {
    expect(getShortlistedParticipantIds(picks)).toEqual(new Set([3, 1, 2]))
  })

  it('displays the shortlist by reference rather than pick order', () => {
    expect(sortShortlistForDisplay(picks).map((pick) => pick.reference)).toEqual(['2', '9', '10'])
  })

  it('compares references numerically', () => {
    expect(compareParticipantReferences({ reference: '9' }, { reference: '10' })).toBeLessThan(0)
  })

  it('formats display initials', () => {
    expect(getDisplayInitials('')).toBe('?')
    expect(getDisplayInitials('Ada')).toBe('AD')
    expect(getDisplayInitials('Ada Lovelace')).toBe('AL')
  })
})
