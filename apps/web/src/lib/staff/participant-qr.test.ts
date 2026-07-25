import { describe, expect, it } from 'vitest'

import { buildParticipantQrValue, parseParticipantQrValue } from './participant-qr'

describe('participant QR payload', () => {
  it('round-trips a single-label domain', () => {
    const value = buildParticipantQrValue({ domain: 'uppis', participantId: 91, reference: '0042' })

    expect(value).toBe('uppis-91-0042')
    expect(parseParticipantQrValue(value)).toEqual({
      domain: 'uppis',
      participantId: '91',
      reference: '0042',
    })
  })

  it('round-trips a domain containing hyphens', () => {
    const value = buildParticipantQrValue({
      domain: 'foto-maraton-2026',
      participantId: 91,
      reference: '0042',
    })

    expect(value).toBe('foto-maraton-2026-91-0042')
    expect(parseParticipantQrValue(value)).toEqual({
      domain: 'foto-maraton-2026',
      participantId: '91',
      reference: '0042',
    })
  })

  it('round-trips when the participant id is missing', () => {
    const value = buildParticipantQrValue({
      domain: 'foto-maraton',
      participantId: null,
      reference: '0042',
    })

    expect(parseParticipantQrValue(value)).toEqual({
      domain: 'foto-maraton',
      participantId: '',
      reference: '0042',
    })
  })

  it('rejects payloads too short to carry a domain, id and reference', () => {
    expect(parseParticipantQrValue(null)).toBeNull()
    expect(parseParticipantQrValue('')).toBeNull()
    expect(parseParticipantQrValue('uppis-0042')).toBeNull()
    expect(parseParticipantQrValue('https://example.com')).toBeNull()
  })

  it('parses any structurally valid payload, leaving the domain check to the caller', () => {
    // Scanning a foreign QR must produce a domain to compare, not a parse failure —
    // that is what lets the scanner say "belongs to another marathon".
    expect(parseParticipantQrValue('other-91-0042')).toEqual({
      domain: 'other',
      participantId: '91',
      reference: '0042',
    })
  })

  it('preserves non-numeric references used by by-camera marathons', () => {
    expect(parseParticipantQrValue('uppis-91-A001')?.reference).toBe('A001')
  })

  it('rejects a payload with an empty domain or reference', () => {
    expect(parseParticipantQrValue('-91-0042')).toBeNull()
    expect(parseParticipantQrValue('uppis-91-')).toBeNull()
  })
})
