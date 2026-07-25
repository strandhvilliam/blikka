import { RedisClient, RedisClientLayer } from '@blikka/redis'
import { Context, Effect, Layer, Option } from 'effect'

/**
 * One ballot entry as every voter in a round sees it.
 *
 * Deliberately excludes `isOwnSubmission`: that is the only per-voter field, so
 * keeping it out is what makes a single cached list serviceable to every voter.
 */
export interface CachedVotingSubmission {
  submissionId: number
  participantId: number
  url: string | undefined
  thumbnailUrl: string | undefined
  topicId: number
  topicName: string
}

/**
 * Short by design. The SMS blast puts ~1000 voters on the same round within a
 * couple of minutes, so even a one-minute window collapses that to a handful of
 * reads. Keeping it short also bounds how long a deleted or disqualified
 * submission can linger on a ballot.
 */
const VOTING_SUBMISSIONS_CACHE_TTL_SECONDS = 60

function votingSubmissionsCacheKey(roundId: number) {
  return `voting-round-submissions:${roundId}`
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isCachedVotingSubmission(value: unknown): value is CachedVotingSubmission {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'submissionId' in value &&
    typeof value.submissionId === 'number' &&
    'participantId' in value &&
    typeof value.participantId === 'number' &&
    'topicId' in value &&
    typeof value.topicId === 'number' &&
    'topicName' in value &&
    typeof value.topicName === 'string'
  )
}

function decodeVotingSubmissions(value: unknown): Option.Option<CachedVotingSubmission[]> {
  const parsed = typeof value === 'string' ? safeParseJson(value) : value

  if (!Array.isArray(parsed) || !parsed.every(isCachedVotingSubmission)) {
    return Option.none()
  }

  return Option.some(parsed)
}

export class VotingSubmissionsCache extends Context.Service<
  VotingSubmissionsCache,
  {
    readonly get: (
      roundId: number,
    ) => Effect.Effect<Option.Option<CachedVotingSubmission[]>, never, never>
    readonly set: (
      roundId: number,
      value: readonly CachedVotingSubmission[],
    ) => Effect.Effect<void, never>
    readonly invalidate: (roundId: number) => Effect.Effect<void, never>
  }
>()('@blikka/api/VotingSubmissionsCache') {}

const makeVotingSubmissionsCache = Effect.gen(function* () {
  const redis = yield* RedisClient

  const get: VotingSubmissionsCache['Service']['get'] = Effect.fn('VotingSubmissionsCache.get')(
    function* (roundId) {
      const key = votingSubmissionsCacheKey(roundId)
      const result = yield* redis.use((client) => client.get(key)).pipe(
        Effect.catchTag('RedisError', (error) =>
          Effect.logWarning('Failed to read voting submissions cache', {
            cause: error,
            roundId,
          }).pipe(Effect.as(null)),
        ),
      )

      if (result === null || result === undefined) {
        return Option.none()
      }

      const decoded = decodeVotingSubmissions(result)
      if (Option.isSome(decoded)) {
        return decoded
      }

      yield* Effect.logWarning('Invalid voting submissions cache value', { roundId })
      yield* redis.use((client) => client.del(key)).pipe(
        Effect.catchTag('RedisError', (error) =>
          Effect.logWarning('Failed to delete invalid voting submissions cache value', {
            cause: error,
            roundId,
          }),
        ),
      )
      return Option.none()
    },
  )

  const set: VotingSubmissionsCache['Service']['set'] = Effect.fn('VotingSubmissionsCache.set')(
    function* (roundId, value) {
      yield* redis
        .use((client) =>
          client.set(votingSubmissionsCacheKey(roundId), JSON.stringify(value), {
            ex: VOTING_SUBMISSIONS_CACHE_TTL_SECONDS,
          }),
        )
        .pipe(
          Effect.catchTag('RedisError', (error) =>
            Effect.logWarning('Failed to write voting submissions cache', {
              cause: error,
              roundId,
            }),
          ),
        )
    },
  )

  const invalidate: VotingSubmissionsCache['Service']['invalidate'] = Effect.fn(
    'VotingSubmissionsCache.invalidate',
  )(function* (roundId) {
    yield* redis.use((client) => client.del(votingSubmissionsCacheKey(roundId))).pipe(
      Effect.catchTag('RedisError', (error) =>
        Effect.logWarning('Failed to invalidate voting submissions cache', {
          cause: error,
          roundId,
        }),
      ),
    )
  })

  return VotingSubmissionsCache.of({
    get,
    set,
    invalidate,
  })
})

export const VotingSubmissionsCacheLayerNoDeps = Layer.effect(
  VotingSubmissionsCache,
  makeVotingSubmissionsCache,
)

export const VotingSubmissionsCacheLayer = VotingSubmissionsCacheLayerNoDeps.pipe(
  Layer.provide(RedisClientLayer),
)
