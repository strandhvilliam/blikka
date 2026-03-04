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
      record: SQSRecord,
    ) {
      const s3Event = yield* parseJson(record.body).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(S3EventSchema)),
        Effect.mapError(
          (cause) =>
            new InvalidS3EventError({
              cause,
              message: "Failed to parse S3 event",
            }),
        ),
      )

      yield* Effect.forEach(
        s3Event.Records,
        (record) =>
          Effect.gen(function* () {
            const key = record.s3.object.key
            const parsed = yield* parseKey(key)
            const { domain, reference, orderIndex } = parsed

            yield* Effect.logInfo("Processing photo")

            const processPhotoEffect = uploadProcessor
              .processPhoto({ ...parsed, key })
              .pipe(
                Effect.tap(() => Effect.logInfo("Photo processed")),
                Effect.tapError((error) => Effect.logError("Error processing photo", error)),
              )

            const channel = yield* PubSubChannel.fromString(
              `${environment}:upload-flow:${domain}-${reference}`,
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
          }).pipe(Effect.annotateLogs({ key: record.s3.object.key })),
        { concurrency: 2 },
      )
    })

    yield* Effect.forEach(event.Records, (record) => processSQSRecord(record), {
      concurrency: 3,
    })
  })
    .pipe(Effect.withSpan("UploadProcessor.handler"), Effect.catch(Effect.logError))

const serviceLayer = Layer.mergeAll(
  UploadProcessorService.layer,
  RunStateService.layer,
  PubSubLoggerService.withTaskName(TASK_NAME),
  TelemetryLayer(`blikka-${getEnvironment()}-${TASK_NAME}`),
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
