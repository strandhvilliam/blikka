import { EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { Config, Console, Effect, Schema, ServiceMap, Layer } from "effect"

export class EventBridgeEffectError extends Schema.TaggedErrorClass<EventBridgeEffectError>()("EventBridgeEffectError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export class EventBridgeEffectClient extends ServiceMap.Service<EventBridgeEffectClient>()(
  "@blikka/aws/eventbridge-effect-client",
  {
    make: Effect.gen(function* () {
      const region = yield* Config.string("AWS_REGION")

      const client = yield* Effect.acquireRelease(
        Effect.sync(() => new EventBridgeClient({ region })),
        (client) => Effect.sync(() => {
          Console.log("Shutting down EventBridge client")
          client.destroy()
        }
        ),
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

      yield* Effect.addFinalizer(() =>
        Console.log("Shutting down EventBridge client"),
      )

      return {
        use,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
