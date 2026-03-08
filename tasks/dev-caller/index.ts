import { LambdaHandler } from "@effect-aws/lambda"
import { Resource as SSTResource } from "sst"
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { Console, Effect, Layer } from "effect"
import { BusService } from "@blikka/aws"
import { PubSubLoggerService } from "@blikka/pubsub"
import { RealtimeEventsService } from "@blikka/realtime"

const getEnvironment = (stage: string): "prod" | "dev" | "staging" => {
  if (stage === "production") return "prod"
  if (stage === "dev" || stage === "development") return "dev"
  return "staging"
}

export const effectHandler = () =>
  Effect.gen(function* () {
    const realtimeEvents = yield* RealtimeEventsService
    const environment = getEnvironment(SSTResource.App.stage)
    const domain = "uppis"
    const reference = "6750"

    yield* realtimeEvents.withEventResult(Console.log("Hello, world!"), {
      eventKey: "dev-caller-completed",
      environment,
      domain,
      reference,
    })
    return yield* Effect.succeed(undefined)
  }).pipe(Effect.withSpan("DevCaller.handler"), Effect.catch((error) => Effect.logError("DevCaller.handler", error)))

export const handler = LambdaHandler.make({
  handler: effectHandler,
  layer: Layer.mergeAll(
    BusService.layer,
    RealtimeEventsService.layer,
    PubSubLoggerService.withTaskName("dev-caller")
  ),
})
