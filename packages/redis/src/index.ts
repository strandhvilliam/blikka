import { Redis } from "@upstash/redis"
import { Config, Console, Duration, Effect, Layer, Schedule, Schema, ServiceMap } from "effect"

export class RedisError extends Schema.TaggedErrorClass<RedisError>()(
  "RedisError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }) {
}

const makeClient = Effect.fn("RedisClient.makeClient")(
  function* (url: string, token: string) {
    const client = new Redis({ url, token })
    yield* Effect.tryPromise({
      try: () => client.ping(),
      catch: (error) => new RedisError({ cause: error, message: "Redis connection failed" }),
    })
    return client
  },
  Effect.retry(Schedule.compose(Schedule.exponential(Duration.seconds(1)), Schedule.recurs(3))),
  Effect.tapError((error) =>
    Effect.logError(error.message ?? "Redis connection failed after retries")
  )
)

export class RedisClient extends ServiceMap.Service<RedisClient>()(
  "@blikka/packages/redis/redis-client",
  {
    make: Effect.gen(function* () {
      const url = yield* Config.string("UPSTASH_REDIS_REST_URL")
      const token = yield* Config.string("UPSTASH_REDIS_REST_TOKEN")
      const client = yield* Effect.acquireRelease(
        makeClient(url, token),
        (client) => Console.log("Shutting down Redis client")
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
      return {
        client,
        use,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
