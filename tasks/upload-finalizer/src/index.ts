import { SQSEvent, SQSRecord } from "aws-lambda"
import { Effect, Layer } from "effect"
import { LambdaHandler } from "@effect-aws/lambda"
import { PubSubChannel, PubSubLoggerService, RunStateService } from "@blikka/pubsub"
import { TelemetryLayer } from "@blikka/telemetry"
import { EventBusDetailTypes, FinalizedEventSchema, parseBusEvent } from "@blikka/bus"
import { getEnvironment } from "./utils"
import { UploadFinalizerService } from "./service"

const TASK_NAME = "upload-finalizer"

const effectHandler = (event: SQSEvent) =>
  Effect.gen(function* () {
    const environment = getEnvironment()
    const runStateService = yield* RunStateService
    const uploadFinalizerService = yield* UploadFinalizerService

    const processSQSRecord = Effect.fn("upload-finalizer.processSQSRecord")(function* (
      record: SQSRecord
    ) {
      const { domain, reference } = yield* parseBusEvent<
        typeof EventBusDetailTypes.Finalized,
        typeof FinalizedEventSchema.Type
      >(record.body, FinalizedEventSchema)

      yield* Effect.logInfo(`[${reference}|${domain}] Finalizing participant`)

      const finalizeEffect = uploadFinalizerService.finalizeParticipant(domain, reference).pipe(
        Effect.tap(() => Effect.logInfo(`[${reference}|${domain}] Participant finalized`)),
        Effect.tapError((error) =>
          Effect.logError(`[${reference}|${domain}] Error finalizing participant`, error)
        )
      )
      const channel = yield* PubSubChannel.fromString(
        `${environment}:upload-flow:${domain}-${reference}`
      )

      return yield* runStateService.withRunStateEvents({
        taskName: TASK_NAME,
        channel,
        effect: finalizeEffect,
        metadata: {
          domain,
          reference,
        },
      })
    })

    yield* Effect.forEach(event.Records, (record) => processSQSRecord(record), {
      concurrency: "unbounded",
    })
  }).pipe(Effect.withSpan("UploadFinalizer.handler"), Effect.catchAll(Effect.logError))

const serviceLayer = Layer.mergeAll(
  RunStateService.Default,
  UploadFinalizerService.Default,
  PubSubLoggerService.withTaskName(TASK_NAME),
  TelemetryLayer(`blikka-${getEnvironment()}-${TASK_NAME}`)
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
