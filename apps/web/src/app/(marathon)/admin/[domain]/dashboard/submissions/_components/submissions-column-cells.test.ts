import { describe, expect, it } from 'vitest'

import { getSubmissionDisplayStatus } from './submissions-column-cells'

const baseParticipant = {
  realtimeIsFinalized: false,
}

describe('getSubmissionDisplayStatus', () => {
  it('shows needs-verification for completed participants when verification is all', () => {
    expect(
      getSubmissionDisplayStatus({
        participant: baseParticipant,
        status: 'completed',
        verificationMode: 'all',
      }),
    ).toBe('needs-verification')
  })

  it('shows needs-verification for completed participants when verification is flagged', () => {
    expect(
      getSubmissionDisplayStatus({
        participant: baseParticipant,
        status: 'completed',
        verificationMode: 'flagged',
      }),
    ).toBe('needs-verification')
  })

  it('keeps completed when verification is none', () => {
    expect(
      getSubmissionDisplayStatus({
        participant: baseParticipant,
        status: 'completed',
        verificationMode: 'none',
      }),
    ).toBe('completed')
  })

  it('keeps verified participants verified', () => {
    expect(
      getSubmissionDisplayStatus({
        participant: baseParticipant,
        status: 'verified',
        verificationMode: 'flagged',
      }),
    ).toBe('verified')
  })

  it('treats realtime finalized as completed for verification badge', () => {
    expect(
      getSubmissionDisplayStatus({
        participant: { realtimeIsFinalized: true },
        status: 'initialized',
        verificationMode: 'flagged',
      }),
    ).toBe('needs-verification')
  })

  it('keeps verified when participant was realtime finalized', () => {
    expect(
      getSubmissionDisplayStatus({
        participant: { realtimeIsFinalized: true },
        status: 'verified',
        verificationMode: 'flagged',
      }),
    ).toBe('verified')
  })

  it('keeps completed for by-camera marathons regardless of verification mode', () => {
    expect(
      getSubmissionDisplayStatus({
        participant: baseParticipant,
        status: 'completed',
        marathonMode: 'by-camera',
        verificationMode: 'all',
      }),
    ).toBe('completed')

    expect(
      getSubmissionDisplayStatus({
        participant: { realtimeIsFinalized: true },
        status: 'initialized',
        marathonMode: 'by-camera',
        verificationMode: 'flagged',
      }),
    ).toBe('completed')
  })
})
