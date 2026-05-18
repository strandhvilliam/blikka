import { Effect } from 'effect'
import type { VotingRound, VotingSession } from '@blikka/db'

import { BadRequestError } from '../errors'
import { parseVotingScheduleInput, getVotingLifecycleState } from './lifecycle'

export const VOTING_SMS_CHUNK_SIZE = 30
export const VOTING_SMS_ENQUEUE_CONCURRENCY = 10
export const VOTING_EMAIL_BATCH_SIZE = 25

export interface VotingSmsQueueMessage {
  votingSessionIds: number[]
  forceResend?: boolean
}

export interface NotificationWarning {
  channel: 'email' | 'sms'
  message: string
  failedSessionIds: number[]
}

export type VotingNotificationChannel = 'email' | 'sms' | 'all'

export function buildVotingInviteMessage({
  marathonName,
  domain,
  token,
}: {
  marathonName: string
  domain: string
  token: string
}) {
  return `Voting is starting for ${marathonName}! Vote here: ${buildVotingInviteUrl({ domain, token })}`
}

export function buildVotingInviteUrl({ domain, token }: { domain: string; token: string }) {
  return `https://${domain}.blikka.app/live/vote/${token}`
}

export function normalizeEmail(email: string | null | undefined) {
  const trimmed = email?.trim()
  return trimmed ? trimmed : null
}

export function getParticipantDisplayName({
  firstName,
  lastName,
}: {
  firstName: string
  lastName: string
}) {
  const fullName = `${firstName} ${lastName}`.trim()
  return firstName.trim() || fullName || 'participant'
}

export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function parseVotingWindow({
  startsAt,
  endsAt,
}: {
  startsAt: string
  endsAt?: string | null
}): Effect.Effect<{ startsAtIso: string; endsAtIso: string | null }, BadRequestError> {
  return Effect.try({
    try: () => parseVotingScheduleInput({ startsAt, endsAt }),
    catch: (error) =>
      new BadRequestError({
        message: error instanceof Error ? error.message : 'Invalid voting timestamps',
        cause: error,
      }),
  })
}

export function ensureSessionDomain(
  votingSession: VotingSession & { marathon?: { domain: string } | null },
  domain: string,
): Effect.Effect<void, BadRequestError> {
  if (votingSession.marathon?.domain && votingSession.marathon.domain !== domain) {
    return Effect.fail(
      new BadRequestError({
        message: 'Voting session not found',
      }),
    )
  }

  return Effect.void
}

export function getSessionDomain(
  votingSession: VotingSession & { marathon?: { domain: string } | null },
): Effect.Effect<string, BadRequestError> {
  const domain = votingSession.marathon?.domain

  if (!domain) {
    return Effect.fail(
      new BadRequestError({
        message: 'Voting session not found',
      }),
    )
  }

  return Effect.succeed(domain)
}

export function ensureVotingSessionWindow(votingWindow: {
  startsAt: string | null
  endsAt: string | null
}): Effect.Effect<void, BadRequestError> {
  const state = getVotingLifecycleState(votingWindow)

  if (state === 'not-started') {
    return Effect.fail(
      new BadRequestError({
        message: 'Voting session has not started yet',
      }),
    )
  }

  if (state === 'ended') {
    return Effect.fail(
      new BadRequestError({
        message: 'Voting session has expired',
      }),
    )
  }

  return Effect.void
}

export function normalizePaginationInput({
  page,
  limit,
}: {
  page?: number | null
  limit?: number | null
}) {
  const normalizedPage = Number.isInteger(page) && page && page > 0 ? page : 1
  const normalizedLimit = Number.isInteger(limit) && limit && limit > 0 ? Math.min(limit, 100) : 50

  return {
    page: normalizedPage,
    limit: normalizedLimit,
  }
}

export function mapRoundSummary(round: VotingRound | null) {
  if (!round) {
    return null
  }

  return {
    id: round.id,
    roundNumber: round.roundNumber,
    kind: round.kind,
    startedAt: round.startedAt,
    endsAt: round.endsAt,
    sourceRoundId: round.sourceRoundId,
  }
}

export function applyLatestRoundVoteToSession({
  votingSession,
  round,
  vote,
}: {
  votingSession: VotingSession & {
    marathon?: { domain: string } | null
    topic?: { name: string } | null
  }
  round: VotingRound | null
  vote: {
    submissionId: number
    votedAt: string
  } | null
}) {
  return {
    ...votingSession,
    voteSubmissionId: vote?.submissionId ?? null,
    votedAt: vote?.votedAt ?? null,
    currentRound: mapRoundSummary(round),
  }
}
