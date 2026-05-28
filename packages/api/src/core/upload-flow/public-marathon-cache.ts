import { RedisClient, RedisClientLayer } from '@blikka/redis'
import { Context, Effect, Layer, Option } from 'effect'
import type { PublicMarathonForClient } from './service'

const PUBLIC_MARATHON_CACHE_TTL_SECONDS = 60

function publicMarathonCacheKey(domain: string) {
  return `public-marathon:${domain}`
}

function decodePublicMarathon(value: unknown): Option.Option<PublicMarathonForClient> {
  const parsed = typeof value === 'string' ? safeParseJson(value) : value

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('domain' in parsed) ||
    typeof parsed.domain !== 'string' ||
    !('topics' in parsed) ||
    !Array.isArray(parsed.topics)
  ) {
    return Option.none()
  }

  return Option.some(parsed as PublicMarathonForClient)
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export class PublicMarathonCache extends Context.Service<
  PublicMarathonCache,
  {
    readonly get: (
      domain: string,
    ) => Effect.Effect<Option.Option<PublicMarathonForClient>, never, never>
    readonly set: (domain: string, value: PublicMarathonForClient) => Effect.Effect<void, never>
    readonly invalidate: (domain: string) => Effect.Effect<void, never>
  }
>()('@blikka/api/PublicMarathonCache') {}

const makePublicMarathonCache = Effect.gen(function* () {
  const redis = yield* RedisClient

  const get: PublicMarathonCache['Service']['get'] = Effect.fn(
    'PublicMarathonCache.get',
  )(function* (domain) {
    const key = publicMarathonCacheKey(domain)
    const result = yield* redis.use((client) => client.get(key)).pipe(
      Effect.catchTag('RedisError', (error) =>
        Effect.logWarning('Failed to read public marathon cache', { cause: error, domain }).pipe(
          Effect.as(null),
        ),
      ),
    )

    if (result === null || result === undefined) {
      return Option.none()
    }

    const decoded = decodePublicMarathon(result)
    if (Option.isSome(decoded)) {
      return decoded
    }

    yield* Effect.logWarning('Invalid public marathon cache value', { domain })
    yield* redis.use((client) => client.del(key)).pipe(
      Effect.catchTag('RedisError', (error) =>
        Effect.logWarning('Failed to delete invalid public marathon cache value', {
          cause: error,
          domain,
        }),
      ),
    )
    return Option.none()
  })

  const set: PublicMarathonCache['Service']['set'] = Effect.fn(
    'PublicMarathonCache.set',
  )(function* (domain, value) {
    yield* redis
      .use((client) =>
        client.set(publicMarathonCacheKey(domain), JSON.stringify(value), {
          ex: PUBLIC_MARATHON_CACHE_TTL_SECONDS,
        }),
      )
      .pipe(
        Effect.catchTag('RedisError', (error) =>
          Effect.logWarning('Failed to write public marathon cache', { cause: error, domain }),
        ),
      )
  })

  const invalidate: PublicMarathonCache['Service']['invalidate'] = Effect.fn(
    'PublicMarathonCache.invalidate',
  )(function* (domain) {
    yield* redis.use((client) => client.del(publicMarathonCacheKey(domain))).pipe(
      Effect.catchTag('RedisError', (error) =>
        Effect.logWarning('Failed to invalidate public marathon cache', { cause: error, domain }),
      ),
    )
  })

  return PublicMarathonCache.of({
    get,
    set,
    invalidate,
  })
})

export const PublicMarathonCacheLayerNoDeps = Layer.effect(
  PublicMarathonCache,
  makePublicMarathonCache,
)

export const PublicMarathonCacheLayer = PublicMarathonCacheLayerNoDeps.pipe(
  Layer.provide(RedisClientLayer),
)
