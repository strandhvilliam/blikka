import { describe, expect, it } from 'vitest'
import {
  buildJuryInviteUrl,
  computeJuryJwtExpSeconds,
  constantTimeTokenEquals,
  formatJuryScopeLabel,
} from './helpers'

describe('buildJuryInviteUrl', () => {
  it('builds live jury URL for domain and token', () => {
    expect(buildJuryInviteUrl({ domain: 'demo', token: 'abc123' })).toBe(
      'https://demo.blikka.app/live/jury/abc123',
    )
  })
})

describe('constantTimeTokenEquals', () => {
  it('returns true for matching tokens', () => {
    expect(constantTimeTokenEquals('abc123', 'abc123')).toBe(true)
  })

  it('returns false for different tokens', () => {
    expect(constantTimeTokenEquals('abc123', 'abc124')).toBe(false)
  })

  it('returns false when lengths differ', () => {
    expect(constantTimeTokenEquals('short', 'much-longer-token')).toBe(false)
  })

  it('returns false for empty tokens', () => {
    expect(constantTimeTokenEquals('', '')).toBe(false)
  })
})

describe('computeJuryJwtExpSeconds', () => {
  it('uses invitation expiry when sooner than max window', () => {
    const iat = 1_700_000_000
    const expiresAt = new Date((iat + 7 * 24 * 60 * 60) * 1000).toISOString()
    expect(computeJuryJwtExpSeconds(expiresAt, iat, 90)).toBe(iat + 7 * 24 * 60 * 60)
  })

  it('caps at max expiry window', () => {
    const iat = 1_700_000_000
    const expiresAt = new Date((iat + 120 * 24 * 60 * 60) * 1000).toISOString()
    expect(computeJuryJwtExpSeconds(expiresAt, iat, 90)).toBe(iat + 90 * 24 * 60 * 60)
  })
})

describe('formatJuryScopeLabel', () => {
  it('formats topic scope', () => {
    expect(
      formatJuryScopeLabel({
        inviteType: 'topic',
        topicName: 'Street',
      }),
    ).toBe('topic "Street"')
  })

  it('formats class scope with device group', () => {
    expect(
      formatJuryScopeLabel({
        inviteType: 'class',
        competitionClassName: 'Pro',
        deviceGroupName: 'Canon',
      }),
    ).toBe('Pro (Canon)')
  })
})
