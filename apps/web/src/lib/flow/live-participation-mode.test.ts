import { describe, expect, it } from 'vitest'

import {
  LIVE_PARTICIPATION_MODE_QUERY_PARAM,
  parseLiveParticipationMode,
  withLiveParticipationMode,
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

describe('withLiveParticipationMode', () => {
  it('adds mode to absolute URLs', () => {
    expect(withLiveParticipationMode('https://event.example.com/live', 'upload')).toBe(
      'https://event.example.com/live?mode=upload',
    )
    expect(withLiveParticipationMode('https://event.example.com/live', 'prepare')).toBe(
      'https://event.example.com/live?mode=prepare',
    )
  })

  it('omits mode when null and clears an existing mode', () => {
    expect(withLiveParticipationMode('https://event.example.com/live', null)).toBe(
      'https://event.example.com/live',
    )
    expect(withLiveParticipationMode('https://event.example.com/live?mode=upload', null)).toBe(
      'https://event.example.com/live',
    )
  })

  it('replaces an existing mode value', () => {
    expect(
      withLiveParticipationMode('https://event.example.com/live?mode=upload', 'prepare'),
    ).toBe('https://event.example.com/live?mode=prepare')
  })

  it('preserves relative URLs', () => {
    expect(withLiveParticipationMode('/live', 'upload')).toBe('/live?mode=upload')
    expect(withLiveParticipationMode('/live?mode=prepare', null)).toBe('/live')
  })
})
