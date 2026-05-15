import { vi } from "vitest"

vi.mock("sst", () => ({
  Resource: {
    SubmissionFinalizedBus: { name: "test-submission-finalized-bus" },
  },
}))

import { assert, describe, it } from "@effect/vitest"
import { PutEventsCommand, type EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { Effect, Layer } from "effect"

import {
  BusService,
  BusServiceLayerNoDeps,
  EventBusDetailTypes,
  FinalizedEventSchema,
} from "./bus-service"
import {
  EventBridgeEffectClient,
  EventBridgeEffectError,
} from "./clients/eventbridge-effect-client"

describe("BusService", () => {
  it.effect("sendFinalizedEvent publishes expected EventBridge entry", () => {
    const sent: Array<PutEventsCommand> = []

    const fakeEb = EventBridgeEffectClient.of({
      use: (fn) =>
        Effect.gen(function* () {
          const client = {
            send: (command: PutEventsCommand) => {
              sent.push(command)
              return Promise.resolve({ FailedEntryCount: 0, Entries: [] })
            },
          } as unknown as EventBridgeClient
          const result = fn(client)
          if (result instanceof Promise) {
            return yield* Effect.tryPromise({
              try: () => result,
              catch: (e) =>
                new EventBridgeEffectError({
                  message: e instanceof Error ? e.message : "eventbridge error",
                  cause: e,
                }),
            })
          }
          return result
        }),
    })

    const layer = BusServiceLayerNoDeps.pipe(
      Layer.provide(Layer.succeed(EventBridgeEffectClient)(fakeEb)),
    )

    return Effect.gen(function* () {
      const bus = yield* BusService
      yield* bus.sendFinalizedEvent("demo", "REF1", "sess-1")

      assert.strictEqual(sent.length, 1)
      const entry = sent[0]?.input.Entries?.[0]
      assert.ok(entry !== undefined)
      assert.strictEqual(entry.EventBusName, "test-submission-finalized-bus")
      assert.strictEqual(entry.Source, EventBusDetailTypes.Finalized)
      assert.strictEqual(entry.DetailType, EventBusDetailTypes.Finalized)

      const detail = JSON.parse(entry.Detail ?? "{}")
      assert.deepStrictEqual(
        detail,
        FinalizedEventSchema.make({
          domain: "demo",
          reference: "REF1",
          uploadSessionId: "sess-1",
        }),
      )
    }).pipe(Effect.provide(layer))
  })
})
