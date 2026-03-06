import { LambdaHandler } from "@effect-aws/lambda"
import { Resource as SSTResource } from "sst"
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { Console, Effect, Layer } from "effect"
import { BusService } from "@blikka/aws"
import { PubSubLoggerService } from "@blikka/pubsub"
import { RealtimeChannel, RealtimeStateEventsService } from "@blikka/realtime"

const getEnvironment = (stage: string): "prod" | "dev" | "staging" => {
  if (stage === "production") return "prod"
  if (stage === "dev" || stage === "development") return "dev"
  return "staging"
}

export const effectHandler = () =>
  Effect.gen(function* () {
    const realtimeStateEvents = yield* RealtimeStateEventsService
    const environment = getEnvironment(SSTResource.App.stage)
    const domain = "uppis"
    const reference = "6750"

    const channel = yield* RealtimeChannel.fromString(
      `${environment}:upload-flow:${domain}-${reference}`
    )

    yield* realtimeStateEvents.withRealtimeStateEvents({
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
    RealtimeStateEventsService.layer,
    PubSubLoggerService.withTaskName("dev-caller")
  ),
})
