import { Effect, Schema, ServiceMap, Layer, Schedule, Duration } from "effect"
import { RedisClient } from "@blikka/redis"
import { Realtime } from "@upstash/realtime"
import { RealtimeChannel, RealtimeError, RealtimeEventName } from "./schemas"

export class RealtimeService extends ServiceMap.Service<RealtimeService>()(
  "@blikka/realtime/realtime-service",
  {
    make: Effect.gen(function* () {
      const redis = yield* RedisClient
      const client = yield* redis.use((redis) => redis)
      const realtime = new Realtime({ redis: client })

      const emit = Effect.fn("RealtimeService.emit")(function* (
        channel: RealtimeChannel,
        eventName: RealtimeEventName,
        payload: unknown,
      ) {
        const channelString = channel.channelString
        const jsonPayload = yield* Effect.try({
          try: () => JSON.stringify(payload),
          catch: (err) => new RealtimeError({ message: "Failed to stringify payload", cause: err }),
        })

        return yield* Effect.tryPromise({
          try: () => (realtime.channel(channelString) as any).emit(eventName, jsonPayload),
          catch: (error) => new RealtimeError({ message: "Failed to emit realtime event", cause: error }),
        }).pipe(
          Effect.retry(Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3)))
        )
      })

      return { emit } as const
    })
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(RedisClient.layer)
  )
}
