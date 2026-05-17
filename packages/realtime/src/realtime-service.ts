import { Effect, Layer, Context, Schedule, Duration } from "effect"
import { RedisClient, RedisClientLayer } from "@blikka/redis"
import { Realtime } from "@upstash/realtime"
import { RealtimeChannel, RealtimeError } from "./channel"

export class RealtimeService extends Context.Service<
  RealtimeService,
  {
    /** Emit an event to a channel. */
    readonly emit: (
      channel: RealtimeChannel,
      eventName: string,
      payload: unknown,
    ) => Effect.Effect<void, RealtimeError>
  }
>()("@blikka/realtime/RealtimeService") {}

const makeRealtimeService = Effect.gen(function* () {
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
      catch: (error) =>
        new RealtimeError({ message: "Failed to emit realtime event", cause: error }),
    }).pipe(
      Effect.retry(Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))),
    )
  })

  return RealtimeService.of({ emit })
})

export const RealtimeServiceNoDepsLayer = Layer.effect(RealtimeService, makeRealtimeService)

export const RealtimeServiceLayer = RealtimeServiceNoDepsLayer.pipe(Layer.provide(RedisClientLayer))
