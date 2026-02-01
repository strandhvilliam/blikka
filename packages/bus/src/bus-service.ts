import { PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { Data, Effect } from "effect"
import { Resource as SSTResource } from "sst"
import { EventBridgeEffectClient } from "./eventbridge-effect-client"
import { FinalizedEventSchema } from "./schemas"
import { EventBusDetailTypes } from "./event-types"

export class EventBusError extends Data.TaggedError("EventBusError")<{
  message?: string
  cause?: unknown
}> {
}

export class BusService extends Effect.Service<BusService>()("@blikka/bus/bus-service", {
  dependencies: [EventBridgeEffectClient.Default],
  effect: Effect.gen(function* () {
    const eb = yield* EventBridgeEffectClient

    const sendFinalizedEvent = Effect.fn("BusService.sendFinalizedEvent")(
      function* (domain: string, reference: string) {
        const command = new PutEventsCommand({
          Entries: [
            {
              EventBusName: SSTResource.SubmissionFinalizedBus.name,
              Source: EventBusDetailTypes.Finalized,
              Detail: JSON.stringify(FinalizedEventSchema.make({ domain, reference })),
              DetailType: EventBusDetailTypes.Finalized,
            },
          ],
        })

        yield* Effect.logInfo(`[${reference}|${domain}] Sending finalized event`)

        return yield* eb.use(async (eb) => eb.send(command))
      },
      Effect.catchTag("EventBridgeEffectError", (error) => {
        return new EventBusError({
          cause: error.cause,
          message: `Unexpected EventBridge error: ${error.message}`,
        })
      })
    )

    return {
      sendFinalizedEvent,
    }
  }),
}) {
}
