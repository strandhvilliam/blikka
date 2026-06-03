import { describe, expect, it } from 'vitest'

import { getFlaggedVerificationOutcome, getPostUploadDestination } from './verification-routing'

describe('verification routing', () => {
  it.each([
    ['all', '/live/verification?participantRef=0001'],
    ['flagged', '/live/verification?participantRef=0001'],
    ['none', '/live/confirmation?participantRef=0001'],
  ] as const)('routes %s mode after upload finalization', (verificationMode, expected) => {
    expect(
      getPostUploadDestination({
        verificationMode,
        serializedParams: '?participantRef=0001',
      }),
    ).toBe(expected)
  })

  it('redirects flagged mode to confirmation on passed validation', () => {
    expect(
      getFlaggedVerificationOutcome({
        decision: 'passed',
        timedOut: false,
        hasError: false,
      }),
    ).toBe('confirmation')
  })

  it('redirects flagged mode to confirmation when a passed decision arrives after timeout', () => {
    expect(
      getFlaggedVerificationOutcome({
        decision: 'passed',
        timedOut: true,
        hasError: false,
      }),
    ).toBe('confirmation')
  })

  it('shows QR in flagged mode when validation flags the submission', () => {
    expect(
      getFlaggedVerificationOutcome({
        decision: 'flagged',
        timedOut: false,
        hasError: false,
      }),
    ).toBe('qr')
  })

  it('shows QR in flagged mode after timeout', () => {
    expect(
      getFlaggedVerificationOutcome({
        decision: 'pending',
        timedOut: true,
        hasError: false,
      }),
    ).toBe('qr')
  })

  it('keeps checking while flagged mode has no validation decision', () => {
    expect(
      getFlaggedVerificationOutcome({
        decision: 'pending',
        timedOut: false,
        hasError: false,
      }),
    ).toBe('checking')
  })
})
