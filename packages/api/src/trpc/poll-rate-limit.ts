import { RedisClient, RedisClientLayer } from '@blikka/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { Context, Effect, Layer } from 'effect'

/**
 * A ceiling on a browser stuck in a retry loop, not a policy on how often a
 * participant may check their upload — so it sits well above real traffic. The
 * chattiest legitimate client polls every 3s (20/min), and one reference can be
 * open on a staff laptop and the participant's phone at the same time, which
 * still lands under half of this. A runaway tab does thousands per minute.
 */
const POLL_RATE_LIMIT_REQUESTS = 120
const POLL_RATE_LIMIT_WINDOW = '1 m'

/** References are 4 characters; the cap only stops an oversized input from becoming an oversized Redis key. */
const MAX_IDENTIFIER_PART_LENGTH = 64

export interface PollRateLimitDecision {
  readonly allowed: boolean
  /** Seconds until the window resets. Only meaningful when `allowed` is false. */
  readonly retryAfterSeconds: number
}

const ALLOWED: PollRateLimitDecision = { allowed: true, retryAfterSeconds: 0 }

/**
 * Buckets on the `(domain, reference)` pair carried in the procedure input.
 *
 * Not the client IP: SSR calls this router from the server's own address and a
 * marathon venue puts every participant behind one wifi egress, so an IP bucket
 * would be simultaneously too coarse for real users and unrepresentative of who
 * is actually calling.
 */
export function pollRateLimitIdentifier(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) {
    return null
  }

  const domain = Reflect.get(input, 'domain')
  const reference = Reflect.get(input, 'reference')

  if (typeof domain !== 'string' || typeof reference !== 'string') {
    return null
  }

  if (domain.length === 0 || reference.length === 0) {
    return null
  }

  return `${domain.slice(0, MAX_IDENTIFIER_PART_LENGTH)}:${reference.slice(0, MAX_IDENTIFIER_PART_LENGTH)}`
}

export class PollRateLimiter extends Context.Service<
  PollRateLimiter,
  {
    readonly check: (identifier: string) => Effect.Effect<PollRateLimitDecision, never, never>
  }
>()('@blikka/api/PollRateLimiter') {}

const makePollRateLimiter = Effect.gen(function* () {
  const redis = yield* RedisClient

  const ratelimit = new Ratelimit({
    redis: redis.client,
    limiter: Ratelimit.fixedWindow(POLL_RATE_LIMIT_REQUESTS, POLL_RATE_LIMIT_WINDOW),
    prefix: '@blikka/poll',
    /**
     * Remembers blocked identifiers in-process for the rest of the window, so a
     * client that has already tripped the limit stops costing a Redis round trip
     * per request — which is the whole point of limiting it.
     */
    ephemeralCache: new Map(),
    analytics: false,
  })

  const check: PollRateLimiter['Service']['check'] = Effect.fn('PollRateLimiter.check')(
    function* (identifier) {
      const result = yield* Effect.tryPromise(() => ratelimit.limit(identifier)).pipe(
        // Fail open. Redis being unreachable must not stop uploads mid-marathon.
        Effect.catchCause((cause) =>
          Effect.logWarning('Poll rate limit check failed, allowing request', {
            cause,
            identifier,
          }).pipe(Effect.as(null)),
        ),
      )

      if (result === null || result.success) {
        return ALLOWED
      }

      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      }
    },
  )

  return PollRateLimiter.of({ check })
})

export const PollRateLimiterLayerNoDeps = Layer.effect(PollRateLimiter, makePollRateLimiter)

export const PollRateLimiterLayer = PollRateLimiterLayerNoDeps.pipe(Layer.provide(RedisClientLayer))
