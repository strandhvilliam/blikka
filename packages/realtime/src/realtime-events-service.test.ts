import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import {
  REALTIME_CHANNEL_ENV,
  REALTIME_EVENT_CHANNELS,
  REALTIME_EVENT_KEY,
  REALTIME_RESULT_OUTCOME,
  getRealtimeResultEventName,
} from "./contract"
import { RealtimeEventsService } from "./realtime-events-service"
import { RealtimeService } from "./realtime-service"
import type { RealtimeChannel } from "./schemas"
import type { RealtimeEventResultPayload } from "./contract"

interface EmittedRealtimeEvent {
  channel: string
  eventName: string
  payload: unknown
}

function makeTestLayer(emittedEvents: EmittedRealtimeEvent[]) {
  return Layer.effect(RealtimeEventsService, RealtimeEventsService.make).pipe(
    Layer.provide(
      Layer.succeed(RealtimeService, {
        emit: (
          channel: RealtimeChannel,
          eventName: string,
          payload: unknown,
        ) =>
          Effect.sync(() => {
            emittedEvents.push({
              channel: channel.channelString,
              eventName,
              payload,
            })
          }),
      } as never),
    ),
  )
}

describe("RealtimeEventsService", () => {
  it.effect("emits exactly one result event per channel on success", () => {
    const emittedEvents: EmittedRealtimeEvent[] = []

    return Effect.gen(function* () {
      const realtimeEvents = yield* RealtimeEventsService

      const result = yield* realtimeEvents.withEventResult(Effect.succeed("ok"), {
        eventKey: REALTIME_EVENT_KEY.SUBMISSION_PROCESSED,
        environment: REALTIME_CHANNEL_ENV.DEV,
        domain: "demo",
        reference: "1234",
        metadata: { orderIndex: 2 },
      })

      expect(result).toBe("ok")
      expect(emittedEvents).toHaveLength(2)
      expect(
        emittedEvents.every(
          ({ eventName }) =>
            eventName ===
            getRealtimeResultEventName(REALTIME_EVENT_KEY.SUBMISSION_PROCESSED),
        ),
      ).toBe(true)

      const payload = emittedEvents[0]?.payload as RealtimeEventResultPayload
      expect(payload.outcome).toBe(REALTIME_RESULT_OUTCOME.SUCCESS)
      expect(payload.orderIndex).toBe(2)
      expect(payload.eventKey).toBe(REALTIME_EVENT_KEY.SUBMISSION_PROCESSED)
      expect(emittedEvents.map(({ channel }) => channel)).toEqual([
        "dev:demo",
        "dev:demo:1234",
      ])
    }).pipe(Effect.provide(makeTestLayer(emittedEvents)))
  })

  it.effect("emits exactly one result event per channel on failure", () => {
    const emittedEvents: EmittedRealtimeEvent[] = []

    return Effect.gen(function* () {
      const realtimeEvents = yield* RealtimeEventsService

      const exit = yield* Effect.exit(
        realtimeEvents.withEventResult(Effect.fail(new Error("boom")), {
          eventKey: REALTIME_EVENT_KEY.PARTICIPANT_FINALIZED,
          environment: REALTIME_CHANNEL_ENV.PROD,
          domain: "demo",
          reference: "1234",
        }),
      )

      expect(exit._tag).toBe("Failure")
      expect(emittedEvents).toHaveLength(2)

      const payload = emittedEvents[0]?.payload as RealtimeEventResultPayload
      expect(payload.outcome).toBe(REALTIME_RESULT_OUTCOME.ERROR)
      expect(payload.eventKey).toBe(REALTIME_EVENT_KEY.PARTICIPANT_FINALIZED)
      expect(
        payload.outcome === REALTIME_RESULT_OUTCOME.ERROR
          ? payload.error
          : undefined,
      ).toBe("boom")
    }).pipe(Effect.provide(makeTestLayer(emittedEvents)))
  })

  it.effect("supports domain-only events without a participant reference", () => {
    const emittedEvents: EmittedRealtimeEvent[] = []

    return Effect.gen(function* () {
      const realtimeEvents = yield* RealtimeEventsService

      yield* realtimeEvents.emitEventResult({
        eventKey: REALTIME_EVENT_KEY.PARTICIPANT_VERIFIED,
        environment: REALTIME_CHANNEL_ENV.DEV,
        domain: "demo",
        channels: REALTIME_EVENT_CHANNELS.DOMAIN,
        outcome: REALTIME_RESULT_OUTCOME.SUCCESS,
        timestamp: 100,
        duration: null,
      })

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0]?.channel).toBe("dev:demo")
    }).pipe(Effect.provide(makeTestLayer(emittedEvents)))
  })
})
