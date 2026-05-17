import { Redis } from "@upstash/redis"
import { Config, Console, Duration, Effect, Layer, Schedule, Schema, Context } from "effect"

export class RedisError extends Schema.TaggedErrorClass<RedisError>()("RedisError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class RedisClient extends Context.Service<
  RedisClient,
  {
    /**
     * Wrapper around Redis client in a scoped effect.
     */
    readonly use: <T>(fn: (client: Redis) => T) => Effect.Effect<Awaited<T>, RedisError, never>
    /**
     * The raw Redis client.
     */
    readonly client: Redis
  }
>()("@blikka/packages/redis/redis-client") {}

export const RedisClientLayer = Layer.effect(
  RedisClient,
  Effect.gen(function* () {
    const url = yield* Config.string("UPSTASH_REDIS_REST_URL")
    const token = yield* Config.string("UPSTASH_REDIS_REST_TOKEN")

    const makeClient = Effect.fnUntraced(
      function* (url: string, token: string) {
        const client = new Redis({ url, token })
        yield* Effect.tryPromise({
          try: () => client.ping(),
          catch: (error) => new RedisError({ cause: error, message: "Redis connection failed" }),
        })
        return client
      },
      Effect.retry(Schedule.both(Schedule.exponential(Duration.seconds(1)), Schedule.recurs(3))),
      Effect.tapError((error) =>
        Effect.logError(error.message ?? "Redis connection failed after retries"),
      ),
    )

    const client = yield* Effect.acquireRelease(makeClient(url, token), (_client) =>
      Console.log("Shutting down Redis client"),
    )
    const use = <T>(fn: (client: Redis) => T): Effect.Effect<Awaited<T>, RedisError, never> =>
      Effect.gen(function* () {
        const result = yield* Effect.try({
          try: () => fn(client),
          catch: (error) =>
            new RedisError({
              cause: error,
              message: "Redis.use error (Sync)",
            }),
        })
        if (result instanceof Promise) {
          return yield* Effect.tryPromise({
            try: () => result,
            catch: (e) =>
              new RedisError({
                cause: e,
                message: "Redis.use error (Async)",
              }),
          })
        } else {
          return result
        }
      })
    return RedisClient.of({
      use,
      client,
    })
  }),
)
