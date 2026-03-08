import { type SQSEvent, type SQSRecord } from "aws-lambda"
import { Effect, Layer } from "effect"
import { LambdaHandler } from "@effect-aws/lambda"
import { PubSubLoggerService } from "@blikka/pubsub"
import { RealtimeStateEventsService } from "@blikka/realtime"
import { TelemetryLayer } from "@blikka/telemetry"
import { FinalizedEventSchema, parseBusEvent } from "@blikka/aws"
import { getEnvironment } from "./utils"
import { UploadFinalizerService } from "./service"

const TASK_NAME = "upload-finalizer"

const effectHandler = (event: SQSEvent) =>
  Effect.gen(function* () {
    const environment = getEnvironment()
    const realtimeStateEvents = yield* RealtimeStateEventsService
    const uploadFinalizerService = yield* UploadFinalizerService

    const processSQSRecord = Effect.fn("upload-finalizer.processSQSRecord")(function* (
      record: SQSRecord
    ) {
      const { domain, reference } = yield* parseBusEvent(record.body, FinalizedEventSchema)

      return yield* Effect.gen(function* () {
        yield* Effect.logInfo("Finalizing participant")

        const finalizeEffect = uploadFinalizerService.finalizeParticipant(domain, reference).pipe(
          Effect.tap(() => Effect.logInfo("Participant finalized")),
          Effect.tapError((error) => Effect.logError("Error finalizing participant", error))
        )

        return yield* realtimeStateEvents.withRealtimeStateEvents(finalizeEffect, {
          taskName: TASK_NAME,
          environment,
          domain,
          reference,
        })
      }).pipe(Effect.annotateLogs({ domain, reference }))
    })

    yield* Effect.forEach(event.Records, (record) => processSQSRecord(record), {
      concurrency: 2,
    })
  }).pipe(Effect.withSpan("UploadFinalizer.handler"), Effect.catch((error) => Effect.logError("Error running upload finalizer", error)))

const serviceLayer = Layer.mergeAll(
  RealtimeStateEventsService.layer,
  UploadFinalizerService.layer,
  PubSubLoggerService.withTaskName(TASK_NAME),
  TelemetryLayer(`blikka-${getEnvironment()}-${TASK_NAME}`)
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
