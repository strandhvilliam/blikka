import { Cause, Effect, Exit, Layer, ServiceMap } from "effect"
import { RealtimeService } from "./realtime-service"
import { RealtimeChannel, RealtimeError } from "./schemas"
import type {
  RealtimeChannelEnv,
  RealtimeEventKey,
  RealtimeEventName,
  RealtimeEventResultPayload,
  RealtimeResultOutcome,
} from "./schemas"
import {
  REALTIME_EVENT_CHANNELS,
  REALTIME_RESULT_OUTCOME,
  getRealtimeResultEventName,
} from "./contract"

interface RealtimeEventMetadata {
  orderIndex?: number
}

type RealtimeEventChannels =
  (typeof REALTIME_EVENT_CHANNELS)[keyof typeof REALTIME_EVENT_CHANNELS]

interface RealtimeEventTargetOptions {
  environment: RealtimeChannelEnv
  domain: string
  reference?: string
  channels?: RealtimeEventChannels
}

interface EmitRealtimeEventOptions extends RealtimeEventTargetOptions {
  eventName: RealtimeEventName
  payload: unknown
}

interface EmitEventResultOptions extends RealtimeEventTargetOptions {
  eventKey: RealtimeEventKey
  outcome: RealtimeResultOutcome
  timestamp: number
  duration?: number | null
  error?: string
  metadata?: RealtimeEventMetadata
}

interface WithEventResultOptions extends RealtimeEventTargetOptions {
  eventKey: RealtimeEventKey
  metadata?: RealtimeEventMetadata
}

function resolveRealtimeEventChannels(
  channels: RealtimeEventChannels | undefined,
  reference: string | undefined,
): RealtimeEventChannels {
  if (channels) {
    return channels
  }

  return reference
    ? REALTIME_EVENT_CHANNELS.BOTH
    : REALTIME_EVENT_CHANNELS.DOMAIN
}

export class RealtimeEventsService extends ServiceMap.Service<RealtimeEventsService>()(
  "@blikka/realtime/realtime-events-service",
  {
    make: Effect.gen(function* () {
      const realtime = yield* RealtimeService

      const emitRealtimeEvent = Effect.fn("RealtimeEventsService.emitRealtimeEvent")(function* (
        {
          environment,
          domain,
          reference,
          channels,
          eventName,
          payload,
        }: EmitRealtimeEventOptions,
      ) {
        const resolvedChannels = resolveRealtimeEventChannels(channels, reference)
        const effects: Effect.Effect<unknown, RealtimeError, never>[] = []

        if (
          resolvedChannels === REALTIME_EVENT_CHANNELS.DOMAIN ||
          resolvedChannels === REALTIME_EVENT_CHANNELS.BOTH
        ) {
          const domainChannel = yield* RealtimeChannel.domainChannel(environment, domain)
          effects.push(realtime.emit(domainChannel, eventName, payload))
        }

        if (
          resolvedChannels === REALTIME_EVENT_CHANNELS.PARTICIPANT ||
          resolvedChannels === REALTIME_EVENT_CHANNELS.BOTH
        ) {
          if (!reference) {
            return yield* Effect.fail(
              new RealtimeError({
                message: "Participant channel emission requires a reference",
              }),
            )
          }

          const participantChannel = yield* RealtimeChannel.participantChannel(
            environment,
            domain,
            reference,
          )
          effects.push(realtime.emit(participantChannel, eventName, payload))
        }

        yield* Effect.all(effects, { concurrency: 2 })
      })

      const emitEventResult = Effect.fn("RealtimeEventsService.emitEventResult")(function* (
        {
          eventKey,
          environment,
          domain,
          reference,
          channels,
          metadata,
          outcome,
          timestamp,
          duration,
          error,
        }: EmitEventResultOptions,
      ) {
        const payload: RealtimeEventResultPayload =
          outcome === REALTIME_RESULT_OUTCOME.SUCCESS
            ? {
                eventKey,
                outcome,
                domain,
                reference: reference ?? null,
                orderIndex: metadata?.orderIndex ?? null,
                timestamp,
                duration: duration ?? null,
              }
            : {
                eventKey,
                outcome,
                domain,
                reference: reference ?? null,
                orderIndex: metadata?.orderIndex ?? null,
                timestamp,
                duration: duration ?? null,
                error: error ?? "Unknown error",
              }

        yield* emitRealtimeEvent({
          environment,
          domain,
          reference,
          channels,
          eventName: getRealtimeResultEventName(eventKey),
          payload,
        })
      })

      const withEventResult = <A, E, R>(
        effect: Effect.Effect<A, E, R>,
        { eventKey, environment, domain, reference, channels, metadata }: WithEventResultOptions,
      ) =>
        Effect.gen(function* () {
          const startTime = Date.now()

          return yield* effect.pipe(
            Effect.onExit((exit) => {
              const timestamp = Date.now()
              const duration = timestamp - startTime

              return Exit.match(exit, {
                onSuccess: () =>
                  emitEventResult({
                    eventKey,
                    environment,
                    domain,
                    reference,
                    channels,
                    metadata,
                    outcome: REALTIME_RESULT_OUTCOME.SUCCESS,
                    timestamp,
                    duration,
                  }).pipe(
                    Effect.tap(() =>
                      Effect.log(
                        `[${eventKey}:${domain}:${reference ?? "domain"}] Published event.result event (success)`,
                      ),
                    ),
                    Effect.catch(() =>
                      Effect.logWarning(
                        `[${eventKey}:${domain}:${reference ?? "domain"}] Failed to publish event.result event (success)`,
                      ),
                    ),
                  ),
                onFailure: (cause) => {
                  const err = Cause.squash(cause)
                  return emitEventResult({
                    eventKey,
                    environment,
                    domain,
                    reference,
                    channels,
                    metadata,
                    outcome: REALTIME_RESULT_OUTCOME.ERROR,
                    timestamp,
                    duration,
                    error: err instanceof Error ? err.message : String(err),
                  }).pipe(
                    Effect.tap(() =>
                      Effect.log(
                        `[${eventKey}:${domain}:${reference ?? "domain"}] Published event.result event (error)`,
                      ),
                    ),
                    Effect.catch(() =>
                      Effect.logWarning(
                        `[${eventKey}:${domain}:${reference ?? "domain"}] Failed to publish event.result event (error)`,
                      ),
                    ),
                  )
                },
              })
            }),
          )
        })

      return {
        emitRealtimeEvent,
        emitEventResult,
        withEventResult,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(RealtimeService.layer),
  )
}
