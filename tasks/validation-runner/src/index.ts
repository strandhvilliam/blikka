import { LambdaHandler } from "@effect-aws/lambda"
import { Effect, Layer } from "effect"
import { type SQSEvent } from "@effect-aws/lambda"
import { FinalizedEventSchema, parseBusEvent } from "@blikka/bus"
import { ValidationRunner } from "./service"
import { TelemetryLayer } from "@blikka/telemetry"
import { PubSubChannel, PubSubLoggerService, RunStateService } from "@blikka/pubsub"
import { Resource as SSTResource } from "sst"
import { type SQSRecord } from "aws-lambda"

const getEnvironment = (): "prod" | "dev" | "staging" => {
  const stage = SSTResource.App.stage
  if (stage === "production") return "prod"
  if (stage === "dev" || stage === "development") return "dev"
  return "staging"
}

const TASK_NAME = "validation-runner"

const effectHandler = (event: SQSEvent) =>
  Effect.gen(function* () {
    const validationRunner = yield* ValidationRunner
    const runStateService = yield* RunStateService
    const environment = getEnvironment()

    const processSQSRecord = Effect.fn("validation-runner.processSQSRecord")(function* (
      record: SQSRecord
    ) {
      const { domain, reference } = yield* parseBusEvent(record.body, FinalizedEventSchema)

      return yield* Effect.gen(function* () {
        yield* Effect.logInfo("Executing validation")

        const validateEffect = validationRunner.execute(domain, reference).pipe(
          Effect.tap(() => Effect.logInfo("Validation executed")),
          Effect.tapError((error) => Effect.logError("Error executing validation", error))
        )

        const channel = yield* PubSubChannel.fromString(
          `${environment}:upload-flow:${domain}-${reference}`
        )

        return yield* runStateService.withRunStateEvents({
          taskName: TASK_NAME,
          channel,
          effect: validateEffect,
          metadata: {
            domain,
            reference,
          },
        })
      }).pipe(Effect.annotateLogs({ domain, reference }))
    })

    yield* Effect.forEach(event.Records, (record) => processSQSRecord(record), { concurrency: 2 })
  }).pipe(Effect.withSpan("ValidationRunner.handler"), Effect.catch((error) => Effect.logError("ValidationRunner.handler", error)))

const serviceLayer = Layer.mergeAll(
  ValidationRunner.layer,
  RunStateService.layer,
  PubSubLoggerService.withTaskName(TASK_NAME),
  TelemetryLayer(`blikka-${getEnvironment()}-${TASK_NAME}`)
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
