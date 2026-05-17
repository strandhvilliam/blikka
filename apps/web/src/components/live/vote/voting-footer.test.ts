import { describe, expect, it } from 'vitest'

import { shouldShowVoteButton } from './voting-footer'

describe('VotingFooter', () => {
  it('shows the vote button only in carousel mode', () => {
    expect(shouldShowVoteButton('carousel')).toBe(true)
    expect(shouldShowVoteButton('grid')).toBe(false)
  })
})
