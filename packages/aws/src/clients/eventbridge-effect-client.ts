import { EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { Console, Effect, Schema, Context, Layer } from "effect"
import { AwsSdkConfig, AwsSdkConfigLayer, awsSdkClientConstructorOptions } from "../aws-sdk-config"

export class EventBridgeEffectError extends Schema.TaggedErrorClass<EventBridgeEffectError>()(
  "EventBridgeEffectError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class EventBridgeEffectClient extends Context.Service<
  EventBridgeEffectClient,
  {
    /**
     * Wrapper around the EventBridge client to be usable as an Effect and closes the client on release.
     */
    readonly use: <T>(
      fn: (client: EventBridgeClient) => T,
    ) => Effect.Effect<Awaited<T>, EventBridgeEffectError, never>
  }
>()("@blikka/aws/eventbridge-effect-client") {}

const makeEventBridgeEffectClient = Effect.gen(function* () {
  const aws = yield* AwsSdkConfig

  const client = yield* Effect.acquireRelease(
    Effect.sync(() => new EventBridgeClient(awsSdkClientConstructorOptions(aws))),
    (client) =>
      Effect.sync(() => {
        Console.log("Shutting down EventBridge client")
        client.destroy()
      }),
  )

  const use = <T>(
    fn: (client: EventBridgeClient) => T,
  ): Effect.Effect<Awaited<T>, EventBridgeEffectError, never> =>
    Effect.gen(function* () {
      const result = yield* Effect.try({
        try: () => fn(client),
        catch: (error) =>
          new EventBridgeEffectError({
            cause: error,
            message: "EventBridge.use error (Sync)",
          }),
      })
      if (result instanceof Promise) {
        return yield* Effect.tryPromise({
          try: () => result,
          catch: (e) =>
            new EventBridgeEffectError({
              cause: e,
              message: "EventBridge.use error (Async)",
            }),
        })
      }
      return result
    })

  yield* Effect.addFinalizer(() => Console.log("Shutting down EventBridge client"))

  return EventBridgeEffectClient.of({
    use,
  })
})

export const EventBridgeEffectClientLayer = Layer.effect(
  EventBridgeEffectClient,
  makeEventBridgeEffectClient,
).pipe(Layer.provide(AwsSdkConfigLayer))
