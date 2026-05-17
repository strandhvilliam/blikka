import { PutEventsCommand, type PutEventsCommandOutput } from '@aws-sdk/client-eventbridge'
import { Schema, Effect, Context, Layer } from 'effect'
import { Resource as SSTResource } from 'sst'
import {
  EventBridgeEffectClient,
  EventBridgeEffectClientLayer,
} from './clients/eventbridge-effect-client'

export const FinalizedEventSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
  uploadSessionId: Schema.String,
})

export class EventBusError extends Schema.TaggedErrorClass<EventBusError>()('EventBusError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export const EventBusDetailTypes = {
  Finalized: 'blikka.bus.finalized',
} as const

export class BusService extends Context.Service<
  BusService,
  {
    /**
     * Sends finalized event to the EventBridge bus. Will be sent in the upload-flow when all photo-submissions are processed.
     * Used to trigger the upload-finalizer workflow and other asynchronous workflows.
     */
    readonly sendFinalizedEvent: (
      domain: string,
      reference: string,
      uploadSessionId: string,
    ) => Effect.Effect<PutEventsCommandOutput, EventBusError, never>
  }
>()('@blikka/aws/bus-service') {}

const makeBusService = Effect.gen(function* () {
  const eb = yield* EventBridgeEffectClient

  const sendFinalizedEvent = Effect.fn('BusService.sendFinalizedEvent')(
    function* (domain: string, reference: string, uploadSessionId: string) {
      const command = new PutEventsCommand({
        Entries: [
          {
            EventBusName: SSTResource.SubmissionFinalizedBus.name,
            Source: EventBusDetailTypes.Finalized,
            Detail: JSON.stringify(
              FinalizedEventSchema.make({ domain, reference, uploadSessionId }),
            ),
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
        message: `Unexpected EventBridge error: ${error.message}`,
      })
    }),
  )

  return BusService.of({
    sendFinalizedEvent,
  })
})

export const BusServiceLayerNoDeps = Layer.effect(BusService, makeBusService)

export const BusServiceLayer = BusServiceLayerNoDeps.pipe(
  Layer.provide(EventBridgeEffectClientLayer),
)
