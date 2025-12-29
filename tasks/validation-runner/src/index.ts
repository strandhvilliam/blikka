import { LambdaHandler, EventBridgeEvent } from "@effect-aws/lambda"
import { Effect, Layer } from "effect"
import { SQSEvent } from "@effect-aws/lambda"
import { EventBusDetailTypes, parseBusEvent } from "@blikka/bus"
import { FinalizedEventSchema } from "@blikka/bus"
import { ValidationRunner } from "./service"
import { TelemetryLayer } from "@blikka/telemetry"
import { PubSubChannel, PubSubLoggerService, RunStateService } from "@blikka/pubsub"
import { Resource as SSTResource } from "sst"
import { SQSRecord } from "aws-lambda"

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

    const processSQSRecord = Effect.fn("ValidationRunner.processSQSRecord")(function* (
      record: SQSRecord
    ) {
      const { domain, reference } = yield* parseBusEvent<
        typeof EventBusDetailTypes.Finalized,
        typeof FinalizedEventSchema.Type
      >(record.body, FinalizedEventSchema)

      yield* Effect.logInfo(`[${reference}|${domain}] Executing validation`)

      const validateEffect = validationRunner.execute(domain, reference).pipe(
        Effect.tap(() => Effect.logInfo(`[${reference}|${domain}] Validation executed`)),
        Effect.tapError((error) =>
          Effect.logError(`[${reference}|${domain}] Error executing validation`, error)
        )
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
    })

    yield* Effect.forEach(event.Records, (record) => processSQSRecord(record), { concurrency: 2 })
  }).pipe(Effect.withSpan("ValidationRunner.handler"), Effect.catchAll(Effect.logError))

const serviceLayer = Layer.mergeAll(
  ValidationRunner.Default,
  RunStateService.Default,
  PubSubLoggerService.withTaskName(TASK_NAME),
  TelemetryLayer(`blikka-${getEnvironment()}-${TASK_NAME}`)
)

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: serviceLayer,
})
