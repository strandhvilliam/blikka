import { Effect, Option, Schedule, Duration, Schema, Context, Layer } from "effect"
import { KeyFactory } from "../key-factory"
import { RedisClient } from "@blikka/redis"
import { makeInitialZipProgress } from "../schema"

export class ZipKVRepository extends Context.Service<ZipKVRepository>()(
  "@blikka/packages/kv-store/zip-kv-repository",
  {
    make: Effect.gen(function* () {
      const redis = yield* RedisClient
      const keyFactory = yield* KeyFactory

      const getZipProgress = Effect.fn("ZipKVRepository.getZipProgress")(
        function* (domain: string, ref: string) {
          const key = keyFactory.zipProgress(domain, ref)
          const result = yield* redis.use((client) => client.get<string | null>(key))
          return Option.fromNullishOr(result)
        },
        Effect.retryOrElse(
          Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3)),
          () => Effect.succeed(Option.none<string>())
        )
      )

      const incrementZipProgress = Effect.fn("ZipKVRepository.updateZipProgress")(
        function* (domain: string, ref: string) {
          const key = keyFactory.zipProgress(domain, ref)
          return yield* redis.use((client) => client.hincrby(key, "progress", 1))
        },
        Effect.retry(
          Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const completeZipProgress = Effect.fn("ZipKVRepository.completeZipProgress")(
        function* (domain: string, ref: string) {
          const key = keyFactory.zipProgress(domain, ref)
          return yield* redis.use((client) => client.hset(key, { status: "completed" }))
        },
        Effect.retry(
          Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const setZipProgressError = Effect.fn("ZipKVRepository.setZipProgressError")(
        function* (domain: string, ref: string, errors: string[]) {
          const key = keyFactory.zipProgress(domain, ref)
          return yield* redis.use((client) => client.hset(key, { errors }))
        },
        Effect.retry(
          Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const initializeZipProgress = Effect.fn("ZipKVRepository.resetZipProgress")(
        function* (domain: string, ref: string, zipKey: string) {
          const key = keyFactory.zipProgress(domain, ref)
          return yield* redis.use((client) => client.hset(key, makeInitialZipProgress(zipKey)))
        },
        Effect.retry(
          Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      return {
        getZipProgress,
        incrementZipProgress,
        setZipProgressError,
        initializeZipProgress,
        completeZipProgress,
      } as const
    }),
  }
) {
  static layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(
      RedisClient.layer,
      KeyFactory.layer,
    ))
  )
}
