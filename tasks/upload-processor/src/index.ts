import { Effect, Layer, Schema } from "effect"
import { type SQSEvent, LambdaHandler } from "@effect-aws/lambda"
import { parseJson, parseKey } from "./utils"
import { InvalidS3EventError } from "./errors"
import { type SQSRecord } from "aws-lambda"
import { UploadProcessorService } from "./processor-service"
import { S3EventSchema } from "./schemas"
import { TelemetryLayer } from "@blikka/telemetry"
import { PubSubChannel, RunStateService, PubSubLoggerService } from "@blikka/pubsub"
import { Resource as SSTResource } from "sst"

const getEnvironment = (): "prod" | "dev" | "staging" => {
  const stage = SSTResource.App.stage
  if (stage === "production") return "prod"
  if (stage === "dev" || stage === "development") return "dev"
  return "staging"
}

const TASK_NAME = "upload-processor"

const effectHandler = (event: SQSEvent) =>
  Effect.gen(function* () {
    const uploadProcessor = yield* UploadProcessorService
    const runStateService = yield* RunStateService
    const environment = getEnvironment()

    const processSQSRecord = Effect.fn("upload-processor.processSQSRecord")(function* (
      record: SQSRecord
    ) {
      const s3Event = yield* parseJson(record.body).pipe(
        Effect.flatMap(Schema.decodeUnknown(S3EventSchema)),
        Effect.mapError(
          (cause) =>
            new InvalidS3EventError({
              cause,
              message: "Failed to parse S3 event",
            })
        )
      )

      yield* Effect.forEach(
        s3Event.Records,
        (record) =>
          Effect.gen(function* () {
            const key = record.s3.object.key
            const { domain, reference, orderIndex } = yield* parseKey(key)
            yield* Effect.logInfo(`[${reference}|${domain}] Processing photo '${key}'`)

            const processPhotoEffect = uploadProcessor.processPhoto(key).pipe(
              Effect.tap(() => Effect.logInfo(`[${reference}|${domain}] Photo processed '${key}'`)),
              Effect.tapError((error) =>
                Effect.logError(`[${reference}|${domain}] Error processing photo '${key}'`, error)
              )
            )
            const channel = yield* PubSubChannel.fromString(
              `${environment}:upload-flow:${domain}-${reference}`
            )

            return yield* runStateService.withRunStateEvents({
              taskName: TASK_NAME,
              channel,
              effect: processPhotoEffect,
              metadata: {
                domain,
                reference,
                orderIndex,
              },
            })
          }),
        { concurrency: 2 }
      )
    })

    yield* Effect.forEach(event.Records, (record) => processSQSRecord(record), {
      concurrency: 3,
    })
  }).pipe(Effect.withSpan("uploadProcessor.handler"), Effect.catchAll(Effect.logError))

const serviceLayer = Layer.mergeAll(
  UploadProcessorService.Default,
  RunStateService.Default,
  PubSubLoggerService.withTaskName(TASK_NAME),
  TelemetryLayer(`blikka-${getEnvironment()}-${TASK_NAME}`)
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
