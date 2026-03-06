import { Cause, Effect, Exit, Schema, ServiceMap, Layer } from "effect"
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
          yield* sendRealtimeStateEvent(taskName, channel, "start", metadata)

          return yield* effect.pipe(
            Effect.onExit((exit) => {
              const duration = Date.now() - startTime

              return Exit.match(exit, {
                onSuccess: () => sendRealtimeStateEvent(taskName, channel, "end", {
                  ...metadata,
                  duration,
                }),
                onFailure: (cause) => {
                  const error = Cause.squash(cause)
                  return sendRealtimeStateEvent(taskName, channel, "end", {
                    ...metadata,
                    error: error instanceof Error ? error.message : String(error),
                    duration,
                  })
                },
              })
            })
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
