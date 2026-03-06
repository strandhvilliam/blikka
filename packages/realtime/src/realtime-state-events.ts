import { Effect, Schema, ServiceMap, Layer } from "effect"
import { RealtimeService } from "./realtime-service"
import { RealtimeChannel, RealtimeMessage } from "./schemas"

interface RealtimeStateEventMetadata {
  domain?: string
  reference?: string
  orderIndex?: number
  error?: string
  duration?: number
}

interface RealtimeStateEventOptions<A, E, R> {
  taskName: string
  channel: RealtimeChannel
  effect: Effect.Effect<A, E, R>
  metadata?: RealtimeStateEventMetadata
}

export const RealtimeStateEventSchema = Schema.Struct({
  domain: Schema.NullOr(Schema.String),
  reference: Schema.NullOr(Schema.String),
  orderIndex: Schema.NullOr(Schema.Number),
  state: Schema.Literals(["start", "end", "once"]),
  taskName: Schema.String,
  timestamp: Schema.Number,
  error: Schema.NullOr(Schema.String),
  duration: Schema.NullOr(Schema.Number),
})

export type RealtimeStateEvent = Schema.Schema.Type<typeof RealtimeStateEventSchema>

export class RealtimeStateEventsService extends ServiceMap.Service<RealtimeStateEventsService>()(
  "@blikka/realtime/realtime-state-events-service",
  {
    make: Effect.gen(function* () {
      const realtime = yield* RealtimeService

      const sendRealtimeStateEvent = Effect.fn("RealtimeStateEventsService.sendRealtimeStateEvent")(function* (
        taskName: string,
        channel: RealtimeChannel,
        state: "start" | "end" | "once",
        metadata?: RealtimeStateEventMetadata
      ) {
        const message = yield* RealtimeMessage.create(
          channel,
          {
            state,
            taskName,
            domain: metadata?.domain ?? null,
            reference: metadata?.reference ?? null,
            orderIndex: metadata?.orderIndex ?? null,
            timestamp: Date.now(),
            error: metadata?.error ?? null,
            duration: metadata?.duration ?? null,
          },
          RealtimeStateEventSchema
        )

        return yield* realtime
          .emit(channel, message)
          .pipe(
            Effect.tap(() => Effect.log(`[${taskName}:${channel.identifier}] Published ${state} event`)),
            Effect.catch((error) => Effect.logError(`[${taskName}:${channel.identifier}] Failed to publish ${state} event`, error))
          )
      })

      const withRealtimeStateEvents = <E, A, R>({
        taskName,
        channel,
        effect,
        metadata,
      }: RealtimeStateEventOptions<A, E, R>) =>
        Effect.gen(function* () {
          const startTime = Date.now()
          // Runs before
          yield* sendRealtimeStateEvent(taskName, channel, "start", metadata)

          return yield* effect.pipe(
            // Runs after error
            Effect.tapError((error) =>
              Effect.gen(function* () {
                const duration = Date.now() - startTime
                yield* sendRealtimeStateEvent(taskName, channel, "end", {
                  ...metadata,
                  error: error instanceof Error ? error.message : String(error),
                  duration,
                }).pipe(Effect.catch((error) => Effect.logError(`[${taskName}:${channel.identifier}] Failed to publish end event`, error)))
                return yield* Effect.fail(error)
              })
            ),
            // Runs after success
            Effect.tap((result) =>
              Effect.gen(function* () {
                const duration = Date.now() - startTime
                yield* sendRealtimeStateEvent(taskName, channel, "end", {
                  ...metadata,
                  duration,
                }).pipe(Effect.catch((error) => Effect.logError(`[${taskName}:${channel.identifier}] Failed to publish end event`, error)))
                return yield* Effect.succeed(result)
              })
            )
          )
        })

      return {
        sendRealtimeStateEvent,
        withRealtimeStateEvents,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(RealtimeService.layer)
  )
}
