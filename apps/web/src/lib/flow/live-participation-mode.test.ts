import { describe, expect, it } from 'vitest'

import {
  LIVE_PARTICIPATION_MODE_QUERY_PARAM,
  parseLiveParticipationMode,
} from './live-participation-mode'

describe('parseLiveParticipationMode', () => {
  it('parses upload and prepare values', () => {
    expect(parseLiveParticipationMode('upload')).toBe('upload')
    expect(parseLiveParticipationMode('prepare')).toBe('prepare')
  })

  it('returns null for missing or invalid values', () => {
    expect(parseLiveParticipationMode(null)).toBeNull()
    expect(parseLiveParticipationMode(undefined)).toBeNull()
    expect(parseLiveParticipationMode('')).toBeNull()
    expect(parseLiveParticipationMode('by-camera')).toBeNull()
    expect(parseLiveParticipationMode('Upload')).toBeNull()
  })

  it('exposes the expected query param name', () => {
    expect(LIVE_PARTICIPATION_MODE_QUERY_PARAM).toBe('mode')
  })
})
