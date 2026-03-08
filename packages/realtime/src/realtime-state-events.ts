import { Cause, Effect, Exit, ServiceMap, Layer } from "effect"
import { RealtimeService } from "./realtime-service"
import {
  RealtimeChannel,
  REALTIME_EVENT_NAME,
  getTaskScopedRealtimeEventNames,
} from "./schemas"
import type {
  RealtimeBaseEventName,
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

      const fanOutEmitForTask = Effect.fn("RealtimeStateEventsService.fanOutEmitForTask")(function* (
        environment: RealtimeChannelEnv,
        domain: string,
        reference: string,
        taskName: string,
        eventName: RealtimeBaseEventName,
        payload: unknown,
      ) {
        const taskScopedEventNames = getTaskScopedRealtimeEventNames(taskName)

        const scopedEventName =
          eventName === REALTIME_EVENT_NAME.TASK_START
            ? taskScopedEventNames.taskStart
            : eventName === REALTIME_EVENT_NAME.TASK_END
              ? taskScopedEventNames.taskEnd
              : taskScopedEventNames.taskError

        yield* fanOutEmit(environment, domain, reference, scopedEventName, payload)
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

          yield* fanOutEmitForTask(
            environment,
            domain,
            reference,
            taskName,
            REALTIME_EVENT_NAME.TASK_START,
            startPayload,
          ).pipe(
            Effect.tap(() => Effect.log(`[${taskName}:${domain}:${reference}] Published task.start events`)),
            Effect.catch(() => Effect.logWarning(`[${taskName}:${domain}:${reference}] Failed to publish task.start events`))
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
                  return fanOutEmitForTask(
                    environment,
                    domain,
                    reference,
                    taskName,
                    REALTIME_EVENT_NAME.TASK_END,
                    endPayload,
                  ).pipe(
                    Effect.tap(() => Effect.log(`[${taskName}:${domain}:${reference}] Published task.end events`)),
                    Effect.catch(() => Effect.logWarning(`[${taskName}:${domain}:${reference}] Failed to publish task.end events`))
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
                  return fanOutEmitForTask(
                    environment,
                    domain,
                    reference,
                    taskName,
                    REALTIME_EVENT_NAME.TASK_ERROR,
                    errorPayload,
                  ).pipe(
                    Effect.tap(() => Effect.log(`[${taskName}:${domain}:${reference}] Published task.error events`)),
                    Effect.catch(() => Effect.logWarning(`[${taskName}:${domain}:${reference}] Failed to publish task.error events`))
                  )
                },
              })
            })
          )
        })

      return {
        fanOutEmit,
        fanOutEmitForTask,
        withRealtimeStateEvents,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(RealtimeService.layer)
  )
}
