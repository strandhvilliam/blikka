import { Effect, Layer } from "effect"
import { type SQSEvent, LambdaHandler } from "@effect-aws/lambda"
import { SheetGeneratorService } from "./sheet-generator-service"
import { TelemetryLayer } from "@blikka/telemetry"
import { FinalizedEventSchema, parseBusEvent } from "@blikka/bus"
import { PubSubChannel, RunStateService, PubSubLoggerService } from "@blikka/pubsub"
import { Resource as SSTResource } from "sst"
import { SQSRecord } from "aws-lambda"

const getEnvironment = (): "prod" | "dev" | "staging" => {
  const stage = SSTResource.App.stage
  if (stage === "production") return "prod"
  if (stage === "dev" || stage === "development") return "dev"
  return "staging"
}

const TASK_NAME = "contact-sheet-generator"

const effectHandler = (event: SQSEvent) =>
  Effect.gen(function* () {
    const sheetGeneratorService = yield* SheetGeneratorService
    const runStateService = yield* RunStateService
    const environment = getEnvironment()

    const processSQSRecord = Effect.fn("ContactSheetGenerator.processSQSRecord")(function* (
      record: SQSRecord
    ) {
      const { domain, reference } = yield* parseBusEvent(record.body, FinalizedEventSchema)

      yield* Effect.logInfo(`[${reference}|${domain}] Generating contact sheet`)

      const generateContactSheetEffect = sheetGeneratorService
        .generateContactSheet({ domain, reference })
        .pipe(
          Effect.tap(() => Effect.logInfo(`[${reference}|${domain}] Contact sheet generated`)),
          Effect.tapError((error) =>
            Effect.logError(
              `[${reference}|${domain}] Error generating contact sheet`,
              error.message
            )
          )
        )

      const channel = yield* PubSubChannel.fromString(
        `${environment}:upload-flow:${domain}-${reference}`
      )

      return yield* runStateService.withRunStateEvents({
        taskName: TASK_NAME,
        channel,
        effect: generateContactSheetEffect,
        metadata: { domain, reference },
      })
    })

    yield* Effect.forEach(event.Records, (record) => processSQSRecord(record), { concurrency: 2 })
  }).pipe(Effect.withSpan("SheetGeneratorService.handler"), Effect.catchAll(Effect.logError))

const serviceLayer = Layer.mergeAll(
  SheetGeneratorService.Default,
  RunStateService.Default,
  PubSubLoggerService.withTaskName(TASK_NAME),
  TelemetryLayer(`blikka-${getEnvironment()}-${TASK_NAME}`)
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
