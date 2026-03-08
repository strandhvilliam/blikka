import { Cause, Effect, Exit, Layer, ServiceMap } from "effect"
import { RealtimeService } from "./realtime-service"
import { RealtimeChannel, RealtimeError } from "./channel"
import { getRealtimeResultEventName } from "./contract"
import type {
  RealtimeChannelEnv,
  RealtimeEventChannels,
  RealtimeEventKey,
  RealtimeEventResultPayload,
  RealtimeResultOutcome,
} from "./contract"

interface RealtimeTarget {
  environment: RealtimeChannelEnv
  domain: string
  reference?: string
  channels?: RealtimeEventChannels
}

export interface EmitEventResultOptions extends RealtimeTarget {
  eventKey: RealtimeEventKey
  outcome: RealtimeResultOutcome
  timestamp: number
  duration?: number | null
  error?: string
  metadata?: { orderIndex?: number }
}

export interface WithEventResultOptions extends RealtimeTarget {
  eventKey: RealtimeEventKey
  metadata?: { orderIndex?: number }
}

function resolveChannels(
  channels: RealtimeEventChannels | undefined,
  reference: string | undefined,
): RealtimeEventChannels {
  return channels ?? (reference ? "both" : "domain")
}

export class RealtimeEventsService extends ServiceMap.Service<RealtimeEventsService>()(
  "@blikka/realtime/RealtimeEventsService",
  {
    make: Effect.gen(function* () {
      const realtime = yield* RealtimeService

      const emitToChannels = Effect.fn("RealtimeEventsService.emitToChannels")(function* (
        { environment, domain, reference, channels }: RealtimeTarget,
        eventName: string,
        payload: unknown,
      ) {
        const resolved = resolveChannels(channels, reference)
        const effects: Effect.Effect<void, RealtimeError>[] = []

        if (resolved === "domain" || resolved === "both") {
          const channel = yield* RealtimeChannel.domain(environment, domain)
          effects.push(realtime.emit(channel, eventName, payload))
        }

        if (resolved === "participant" || resolved === "both") {
          if (!reference) {
            return yield* new RealtimeError({
              message: "Participant channel emission requires a reference",
            })
          }
          const channel = yield* RealtimeChannel.participant(environment, domain, reference)
          effects.push(realtime.emit(channel, eventName, payload))
        }

        yield* Effect.all(effects, { concurrency: 2 })
      })

      const emitEventResult = Effect.fn("RealtimeEventsService.emitEventResult")(function* (
        options: EmitEventResultOptions,
      ) {
        const { eventKey, domain, reference, metadata, outcome, timestamp, duration, error } = options

        const payload: RealtimeEventResultPayload =
          outcome === "success"
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

        yield* emitToChannels(options, getRealtimeResultEventName(eventKey), payload)
      })

      const withEventResult = <A, E, R>(
        effect: Effect.Effect<A, E, R>,
        options: WithEventResultOptions,
      ) =>
        Effect.gen(function* () {
          const startTime = Date.now()
          const logTag = `[${options.eventKey}:${options.domain}:${options.reference ?? "domain"}]`

          return yield* effect.pipe(
            Effect.onExit((exit) => {
              const timestamp = Date.now()
              const duration = timestamp - startTime

              const { outcome, error } = Exit.match(exit, {
                onSuccess: () => ({
                  outcome: "success" as const,
                  error: undefined,
                }),
                onFailure: (cause) => {
                  const err = Cause.squash(cause)
                  return {
                    outcome: "error" as const,
                    error: err instanceof Error ? err.message : String(err),
                  }
                },
              })

              return emitEventResult({
                ...options,
                outcome,
                timestamp,
                duration,
                error,
              }).pipe(
                Effect.tap(() =>
                  Effect.log(`${logTag} Published event.result (${outcome})`),
                ),
                Effect.catch(() =>
                  Effect.logWarning(`${logTag} Failed to publish event.result (${outcome})`),
                ),
              )
            }),
          )
        })

      return { emitEventResult, withEventResult } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(RealtimeService.layer),
  )
}
