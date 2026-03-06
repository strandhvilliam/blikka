import { Effect, Schema, ServiceMap, Layer, Schedule, Duration } from "effect"
import { RedisClient } from "@blikka/redis"
import { Realtime } from "@upstash/realtime"
import { RealtimeChannel, RealtimeError, RealtimeMessage } from "./schemas"

export class RealtimeService extends ServiceMap.Service<RealtimeService>()(
  "@blikka/realtime/realtime-service",
  {
    make: Effect.gen(function* () {
      const redis = yield* RedisClient
      const client = yield* redis.use((redis) => redis)
      const realtime = new Realtime({ redis: client })


      const emit = Effect.fn("RealtimeService.send")(function* (channel: RealtimeChannel, message: RealtimeMessage) {
        const validChannel = yield* Schema.decodeUnknownEffect(RealtimeChannel)(channel)
          .pipe(Effect.mapError((e) => new RealtimeError({ message: `Invalid realtime channel: ${String(e.message)}`, cause: e })))
        const validMessage = yield* Schema.decodeUnknownEffect(RealtimeMessage)(message)
          .pipe(Effect.mapError((e) => new RealtimeError({ message: `Invalid realtime message: ${String(e.message)}`, cause: e })))

        const channelString = yield* RealtimeChannel.stringify(validChannel)
        const jsonString = yield* RealtimeMessage.jsonStringify(validMessage)

        return yield* Effect.tryPromise({
          try: () => (realtime.channel(channelString) as any).emit("event", jsonString),
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


