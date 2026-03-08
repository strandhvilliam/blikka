import { Cause, Effect, Exit, ServiceMap, Layer } from "effect"
import { RealtimeService } from "./realtime-service"
import { RealtimeChannel } from "./schemas"
import type {
  RealtimeChannelEnv,
  RealtimeEventName,
  TaskStartPayload,
  TaskEndPayload,
  TaskErrorPayload,
} from "./schemas"

interface RealtimeStateEventMetadata {
  orderIndex?: number
}

interface RealtimeStateEventOptions {
  taskName: string
  environment: RealtimeChannelEnv
  domain: string
  reference: string
  metadata?: RealtimeStateEventMetadata
}

export class RealtimeStateEventsService extends ServiceMap.Service<RealtimeStateEventsService>()(
  "@blikka/realtime/realtime-state-events-service",
  {
    make: Effect.gen(function* () {
      const realtime = yield* RealtimeService

      const fanOutEmit = Effect.fn("RealtimeStateEventsService.fanOutEmit")(function* (
        environment: RealtimeChannelEnv,
        domain: string,
        reference: string,
        eventName: RealtimeEventName,
        payload: unknown,
      ) {
        const domainChannel = yield* RealtimeChannel.domainChannel(environment, domain)
        const participantChannel = yield* RealtimeChannel.participantChannel(environment, domain, reference)

        yield* Effect.all([
          realtime.emit(domainChannel, eventName, payload),
          realtime.emit(participantChannel, eventName, payload),
        ], { concurrency: 2 })
      })

      const withRealtimeStateEvents = <A, E, R>(
        effect: Effect.Effect<A, E, R>,
        { taskName, environment, domain, reference, metadata }: RealtimeStateEventOptions,
      ) =>
        Effect.gen(function* () {
          const startTime = Date.now()

          const startPayload: TaskStartPayload = {
            taskName,
            domain,
            reference,
            orderIndex: metadata?.orderIndex ?? null,
            timestamp: startTime,
          }

          yield* fanOutEmit(environment, domain, reference, "task.start", startPayload).pipe(
            Effect.tap(() => Effect.log(`[${taskName}:${domain}:${reference}] Published task.start event`)),
            Effect.catch(() => Effect.logWarning(`[${taskName}:${domain}:${reference}] Failed to publish task.start event`))
          )

          return yield* effect.pipe(
            Effect.onExit((exit) => {
              const duration = Date.now() - startTime

              return Exit.match(exit, {
                onSuccess: () => {
                  const endPayload: TaskEndPayload = {
                    taskName,
                    domain,
                    reference,
                    orderIndex: metadata?.orderIndex ?? null,
                    timestamp: Date.now(),
                    duration,
                  }
                  return fanOutEmit(environment, domain, reference, "task.end", endPayload).pipe(
                    Effect.tap(() => Effect.log(`[${taskName}:${domain}:${reference}] Published task.end event`)),
                    Effect.catch(() => Effect.logWarning(`[${taskName}:${domain}:${reference}] Failed to publish task.end event`))
                  )
                },
                onFailure: (cause) => {
                  const err = Cause.squash(cause)
                  const errorPayload: TaskErrorPayload = {
                    taskName,
                    domain,
                    reference,
                    orderIndex: metadata?.orderIndex ?? null,
                    timestamp: Date.now(),
                    duration,
                    error: err instanceof Error ? err.message : String(err),
                  }
                  return fanOutEmit(environment, domain, reference, "task.error", errorPayload).pipe(
                    Effect.tap(() => Effect.log(`[${taskName}:${domain}:${reference}] Published task.error event`)),
                    Effect.catch(() => Effect.logWarning(`[${taskName}:${domain}:${reference}] Failed to publish task.error event`))
                  )
                },
              })
            })
          )
        })

      return {
        fanOutEmit,
        withRealtimeStateEvents,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(RealtimeService.layer)
  )
}
