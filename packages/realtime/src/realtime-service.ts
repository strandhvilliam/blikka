import { Effect, Layer, ServiceMap, Schedule, Duration } from "effect"
import { RedisClient } from "@blikka/redis"
import { Realtime } from "@upstash/realtime"
import { RealtimeChannel, RealtimeError } from "./channel"

export class RealtimeService extends ServiceMap.Service<RealtimeService, {
  emit(channel: RealtimeChannel, eventName: string, payload: unknown): Effect.Effect<void, RealtimeError>
}>()(
  "@blikka/realtime/RealtimeService", {
  make: Effect.gen(function* () {

    const redis = yield* RedisClient
    const client = yield* redis.use((redis) => redis)
    const realtime = new Realtime({ redis: client })

    const emit = Effect.fn("RealtimeService.emit")(function* (
      channel: RealtimeChannel,
      eventName: string,
      payload: unknown,
    ) {
      const jsonPayload = yield* Effect.try({
        try: () => JSON.stringify(payload),
        catch: (err) => new RealtimeError({ message: "Failed to stringify payload", cause: err }),
      })

      yield* Effect.tryPromise({
        try: () => (realtime.channel(channel.channelString) as any).emit(eventName, jsonPayload),
        catch: (error) => new RealtimeError({ message: "Failed to emit realtime event", cause: error }),
      }).pipe(
        Effect.retry(Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))),
      )
    })

    return { emit } as const
  })
}
) {


  static readonly layer = Layer.effect(this, this.make).pipe(Layer.provide(RedisClient.layer))
}
