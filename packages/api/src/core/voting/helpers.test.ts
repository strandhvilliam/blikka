import { Cause, Effect, Exit } from 'effect'
import type { VotingRound, VotingSession } from '@blikka/db'
import { describe, expect, it } from 'vitest'

import { BadRequestError } from '../errors'
import {
  applyLatestRoundVoteToSession,
  buildVotingInviteMessage,
  buildVotingInviteUrl,
  ensureSessionDomain,
  ensureVotingSessionWindow,
  getErrorMessage,
  getParticipantDisplayName,
  getSessionDomain,
  mapRoundSummary,
  normalizeEmail,
  normalizePaginationInput,
  parseVotingWindow,
} from './helpers'

const domain = 'demo'
const now = new Date('2026-03-17T10:30:00.000Z')

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

const runEffect = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSyncExit(effect)

describe('buildVotingInviteUrl', () => {
  it('builds the live voting URL', () => {
    expect(buildVotingInviteUrl({ domain, token: 'abc123' })).toBe(
      'https://demo.blikka.app/live/vote/abc123',
    )
  })
})

describe('buildVotingInviteMessage', () => {
  it('includes marathon name and invite URL', () => {
    expect(
      buildVotingInviteMessage({
        marathonName: 'Demo Marathon',
        domain,
        token: 'abc123',
      }),
    ).toBe(
      'Voting is starting for Demo Marathon! Vote here: https://demo.blikka.app/live/vote/abc123',
    )
  })
})

describe('normalizeEmail', () => {
  it('trims and returns null for empty values', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com')
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })
})

describe('getParticipantDisplayName', () => {
  it('prefers first name when present', () => {
    expect(getParticipantDisplayName({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane')
  })

  it('falls back to full name or participant', () => {
    expect(getParticipantDisplayName({ firstName: ' ', lastName: 'Doe' })).toBe('Doe')
    expect(getParticipantDisplayName({ firstName: ' ', lastName: ' ' })).toBe('participant')
  })
})

describe('getErrorMessage', () => {
  it('returns Error.message when available', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
  })

  it('returns fallback for non-error values', () => {
    expect(getErrorMessage('nope', 'fallback')).toBe('fallback')
  })
})

describe('parseVotingWindow', () => {
  it('parses valid voting windows', () => {
    const exit = runEffect(
      parseVotingWindow({
        startsAt: '2026-03-17T10:00:00.000Z',
        endsAt: '2026-03-17T12:00:00.000Z',
      }),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual({
        startsAtIso: '2026-03-17T10:00:00.000Z',
        endsAtIso: '2026-03-17T12:00:00.000Z',
      })
    }
  })

  it('fails for invalid schedules', () => {
    const exit = runEffect(
      parseVotingWindow({
        startsAt: 'invalid',
        endsAt: null,
      }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(Cause.squash(exit.cause)).toBeInstanceOf(BadRequestError)
    }
  })
})

describe('ensureSessionDomain', () => {
  const session = {
    id: 1,
    marathon: { domain },
  } as VotingSession & { marathon?: { domain: string } | null }

  it('succeeds when domains match', () => {
    const exit = runEffect(ensureSessionDomain(session, domain))
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('fails when domains differ', () => {
    const exit = runEffect(ensureSessionDomain(session, 'other'))
    expect(Exit.isFailure(exit)).toBe(true)
  })
})

describe('getSessionDomain', () => {
  it('returns the marathon domain', () => {
    const exit = runEffect(
      getSessionDomain({
        id: 1,
        marathon: { domain },
      } as VotingSession & { marathon?: { domain: string } | null }),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(domain)
    }
  })

  it('fails when marathon domain is missing', () => {
    const exit = runEffect(
      getSessionDomain({ id: 1, marathon: null } as VotingSession & {
        marathon?: { domain: string } | null
      }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
  })
})

describe('ensureVotingSessionWindow', () => {
  it('allows active voting windows', () => {
    const exit = runEffect(
      ensureVotingSessionWindow({
        startsAt: hoursFromNow(-1),
        endsAt: hoursFromNow(1),
      }),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('rejects windows that have not started', () => {
    const exit = runEffect(
      ensureVotingSessionWindow({
        startsAt: hoursFromNow(1),
        endsAt: hoursFromNow(2),
      }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause)
      expect(error).toBeInstanceOf(BadRequestError)
      if (error instanceof BadRequestError) {
        expect(error.message).toBe('Voting session has not started yet')
      }
    }
  })

  it('rejects expired voting windows', () => {
    const exit = runEffect(
      ensureVotingSessionWindow({
        startsAt: hoursFromNow(-2),
        endsAt: hoursFromNow(-1),
      }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause)
      expect(error).toBeInstanceOf(BadRequestError)
      if (error instanceof BadRequestError) {
        expect(error.message).toBe('Voting session has expired')
      }
    }
  })
})

describe('normalizePaginationInput', () => {
  it('defaults invalid values and caps limit at 100', () => {
    expect(normalizePaginationInput({ page: 0, limit: 500 })).toEqual({
      page: 1,
      limit: 100,
    })
  })

  it('preserves valid pagination values', () => {
    expect(normalizePaginationInput({ page: 3, limit: 25 })).toEqual({
      page: 3,
      limit: 25,
    })
  })
})

describe('mapRoundSummary', () => {
  it('returns null for missing rounds', () => {
    expect(mapRoundSummary(null)).toBeNull()
  })

  it('maps round fields', () => {
    const round = {
      id: 10,
      roundNumber: 2,
      kind: 'standard',
      startedAt: '2026-03-17T10:00:00.000Z',
      endsAt: '2026-03-17T11:00:00.000Z',
      sourceRoundId: null,
    } as VotingRound

    expect(mapRoundSummary(round)).toEqual({
      id: 10,
      roundNumber: 2,
      kind: 'standard',
      startedAt: '2026-03-17T10:00:00.000Z',
      endsAt: '2026-03-17T11:00:00.000Z',
      sourceRoundId: null,
    })
  })
})

describe('applyLatestRoundVoteToSession', () => {
  it('merges vote and round summary onto the session', () => {
    const votingSession = {
      id: 1,
      marathon: { domain },
      topic: { name: 'Topic 1' },
    } as VotingSession & {
      marathon?: { domain: string } | null
      topic?: { name: string } | null
    }

    const round = {
      id: 10,
      roundNumber: 1,
      kind: 'standard',
      startedAt: now.toISOString(),
      endsAt: null,
      sourceRoundId: null,
    } as VotingRound

    expect(
      applyLatestRoundVoteToSession({
        votingSession,
        round,
        vote: {
          submissionId: 99,
          votedAt: now.toISOString(),
        },
      }),
    ).toEqual({
      ...votingSession,
      voteSubmissionId: 99,
      votedAt: now.toISOString(),
      currentRound: mapRoundSummary(round),
    })
  })
})
