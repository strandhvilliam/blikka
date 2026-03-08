import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { getRealtimeResultEventName } from "./contract"
import type { RealtimeEventResultPayload } from "./contract"
import { RealtimeEventsService } from "./realtime-events-service"
import { RealtimeService } from "./realtime-service"
import type { RealtimeChannel } from "./channel"

interface EmittedRealtimeEvent {
  channel: string
  eventName: string
  payload: unknown
}

function makeTestLayer(emittedEvents: EmittedRealtimeEvent[]) {
  const mockRealtimeService = Layer.succeed(
    RealtimeService,
    RealtimeService.of({
      emit: (channel: RealtimeChannel, eventName: string, payload: unknown) =>
        Effect.sync(() => {
          emittedEvents.push({
            channel: channel.channelString,
            eventName,
            payload,
          })
        }),
    }),
  )
  return Layer.effect(RealtimeEventsService, RealtimeEventsService.make).pipe(
    Layer.provide(mockRealtimeService),
  )
}

describe("RealtimeEventsService", () => {
  it.effect("emits exactly one result event per channel on success", () => {
    const emittedEvents: EmittedRealtimeEvent[] = []

    return Effect.gen(function* () {
      const realtimeEvents = yield* RealtimeEventsService

      const result = yield* realtimeEvents.withEventResult(Effect.succeed("ok"), {
        eventKey: "submission-processed",
        environment: "dev",
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
            getRealtimeResultEventName("submission-processed"),
        ),
      ).toBe(true)

      const payload = emittedEvents[0]?.payload as RealtimeEventResultPayload
      expect(payload.outcome).toBe("success")
      expect(payload.orderIndex).toBe(2)
      expect(payload.eventKey).toBe("submission-processed")
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
          eventKey: "participant-finalized",
          environment: "prod",
          domain: "demo",
          reference: "1234",
        }),
      )

      expect(exit._tag).toBe("Failure")
      expect(emittedEvents).toHaveLength(2)

      const payload = emittedEvents[0]?.payload as RealtimeEventResultPayload
      expect(payload.outcome).toBe("error")
      expect(payload.eventKey).toBe("participant-finalized")
      expect(
        payload.outcome === "error"
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
        eventKey: "participant-verified",
        environment: "dev",
        domain: "demo",
        channels: "domain",
        outcome: "success",
        timestamp: 100,
        duration: null,
      })

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0]?.channel).toBe("dev:demo")
    }).pipe(Effect.provide(makeTestLayer(emittedEvents)))
  })
})
