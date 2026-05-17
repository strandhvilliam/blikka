import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { getRealtimeResultEventName, getVotingVoteCastEventName } from "./contract"
import type { RealtimeEventResultPayload, VotingVoteCastPayload } from "./contract"
import { RealtimeEventsService, RealtimeEventsServiceNoDepsLayer } from "./realtime-events-service"
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

  return RealtimeEventsServiceNoDepsLayer.pipe(Layer.provide(mockRealtimeService))
}

describe("RealtimeEventsService", () => {
  describe("withEventResult", () => {
    it.effect("should emit one result event per channel on success", () => {
      const emittedEvents: EmittedRealtimeEvent[] = []
      const layer = makeTestLayer(emittedEvents)

      return Effect.gen(function* () {
        const realtimeEvents = yield* RealtimeEventsService

        const result = yield* realtimeEvents.withEventResult(Effect.succeed("ok"), {
          eventKey: "submission-processed",
          environment: "dev",
          domain: "demo",
          reference: "1234",
          metadata: { orderIndex: 2 },
        })

        assert.strictEqual(result, "ok")
        assert.lengthOf(emittedEvents, 2)
        assert.ok(
          emittedEvents.every(
            ({ eventName }) => eventName === getRealtimeResultEventName("submission-processed"),
          ),
        )

        const payload = emittedEvents[0]?.payload as RealtimeEventResultPayload
        assert.strictEqual(payload.outcome, "success")
        assert.strictEqual(payload.orderIndex, 2)
        assert.strictEqual(payload.eventKey, "submission-processed")
        assert.deepStrictEqual(
          emittedEvents.map(({ channel }) => channel),
          ["dev:demo", "dev:demo:1234"],
        )
      }).pipe(Effect.provide(layer))
    })

    it.effect("should emit one result event per channel on failure", () => {
      const emittedEvents: EmittedRealtimeEvent[] = []
      const layer = makeTestLayer(emittedEvents)

      return Effect.gen(function* () {
        const realtimeEvents = yield* RealtimeEventsService

        const error = yield* realtimeEvents
          .withEventResult(Effect.fail(new Error("boom")), {
            eventKey: "participant-finalized",
            environment: "prod",
            domain: "demo",
            reference: "1234",
          })
          .pipe(Effect.flip)

        assert.instanceOf(error, Error)
        assert.strictEqual(error.message, "boom")
        assert.lengthOf(emittedEvents, 2)

        const payload = emittedEvents[0]?.payload as RealtimeEventResultPayload
        assert.strictEqual(payload.outcome, "error")
        assert.strictEqual(payload.eventKey, "participant-finalized")
        assert.strictEqual(payload.outcome === "error" ? payload.error : undefined, "boom")
      }).pipe(Effect.provide(layer))
    })
  })

  describe("emitEventResult", () => {
    it.effect("should support domain-only events without a participant reference", () => {
      const emittedEvents: EmittedRealtimeEvent[] = []
      const layer = makeTestLayer(emittedEvents)

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

        assert.lengthOf(emittedEvents, 1)
        assert.strictEqual(emittedEvents[0]?.channel, "dev:demo")
      }).pipe(Effect.provide(layer))
    })
  })

  describe("emitVotingVoteCast", () => {
    it.effect("should emit voting vote-cast updates on the domain channel", () => {
      const emittedEvents: EmittedRealtimeEvent[] = []
      const layer = makeTestLayer(emittedEvents)

      return Effect.gen(function* () {
        const realtimeEvents = yield* RealtimeEventsService

        yield* realtimeEvents.emitVotingVoteCast({
          environment: "dev",
          domain: "demo",
          topicId: 7,
          sessionId: 42,
          submissionId: 99,
          votedAt: "2026-03-17T12:00:00.000Z",
          participantReference: "1234",
          participantFirstName: "Ada",
          participantLastName: "Lovelace",
          submissionCreatedAt: "2026-03-17T11:00:00.000Z",
          submissionKey: "submission-key",
          submissionThumbnailKey: "thumb-key",
        })

        assert.lengthOf(emittedEvents, 1)
        assert.strictEqual(emittedEvents[0]?.channel, "dev:demo")
        assert.strictEqual(emittedEvents[0]?.eventName, getVotingVoteCastEventName())

        const payload = emittedEvents[0]?.payload as VotingVoteCastPayload
        assert.strictEqual(payload.eventId, "42:2026-03-17T12:00:00.000Z")
        assert.strictEqual(payload.submissionId, 99)
      }).pipe(Effect.provide(layer))
    })
  })
})
