import { LambdaHandler } from "@effect-aws/lambda"
import { Resource as SSTResource } from "sst"
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { Console, Effect, Layer } from "effect"
import { BusService } from "@blikka/aws"
import { PubSubChannel, PubSubLoggerService, RunStateService } from "@blikka/pubsub"

const getEnvironment = (stage: string): "prod" | "dev" | "staging" => {
  if (stage === "production") return "prod"
  if (stage === "dev" || stage === "development") return "dev"
  return "staging"
}

export const effectHandler = () =>
  Effect.gen(function* () {
    const runStateService = yield* RunStateService
    const environment = getEnvironment(SSTResource.App.stage)
    const domain = "uppis"
    const reference = "6750"

    const channel = yield* PubSubChannel.fromString(
      `${environment}:upload-flow:${domain}-${reference}`
    )

    yield* runStateService.withRunStateEvents({
      taskName: "dev-caller",
      channel,
      effect: Console.log("Hello, world!"),
      metadata: {},
    })
    return yield* Effect.succeed(undefined)
  }).pipe(Effect.withSpan("DevCaller.handler"), Effect.catchAll(Effect.logError))

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: Layer.mergeAll(
    BusService.Default,
    RunStateService.Default,
    PubSubLoggerService.withTaskName("dev-caller")
  ),
})
