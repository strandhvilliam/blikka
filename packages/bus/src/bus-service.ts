import { PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { Schema, Effect, ServiceMap, Layer } from "effect"
import { Resource as SSTResource } from "sst"
import { EventBridgeEffectClient } from "./eventbridge-effect-client"
import { FinalizedEventSchema } from "./schemas"
import { EventBusDetailTypes } from "./event-types"

export class EventBusError extends Schema.TaggedErrorClass<EventBusError>()("EventBusError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export class BusService extends ServiceMap.Service<BusService>()("@blikka/bus/bus-service", {
  make: Effect.gen(function* () {
    const eb = yield* EventBridgeEffectClient

    const sendFinalizedEvent = Effect.fn("BusService.sendFinalizedEvent")(
      function* (domain: string, reference: string) {
        const command = new PutEventsCommand({
          Entries: [
            {
              EventBusName: SSTResource.SubmissionFinalizedBus.name,
              Source: EventBusDetailTypes.Finalized,
              Detail: JSON.stringify(FinalizedEventSchema.makeUnsafe({ domain, reference })),
              DetailType: EventBusDetailTypes.Finalized,
            },
          ],
        })

        yield* Effect.logInfo(`[${reference}|${domain}] Sending finalized event`)

        return yield* eb.use(async (eb) => eb.send(command))
      },
      Effect.mapError((error) => {
        return new EventBusError({
          cause: error,
          message: "Unexpected EventBridge error",
        })
      })
    )

    return {
      sendFinalizedEvent,
    } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(EventBridgeEffectClient.layer),
  )
}
