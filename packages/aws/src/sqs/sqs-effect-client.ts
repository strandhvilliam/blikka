import { SQSClient } from "@aws-sdk/client-sqs"
import { Config, Console, ServiceMap, Effect, Schema, Layer } from "effect"

export class SQSEffectError extends Schema.TaggedErrorClass<SQSEffectError>()("SQSEffectError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export class SQSEffectClient extends ServiceMap.Service<SQSEffectClient>()(
  "@blikka/aws/sqs-effect-client",
  {
    make: Effect.gen(function* () {
      const region = yield* Config.string("AWS_REGION")

      const client = yield* Effect.acquireRelease(
        Effect.sync(() => new SQSClient({ region })),
        (client) => Effect.sync(() => {
          Console.log("Shutting down SQS client")
          client.destroy()
        }
        ),
      )
      const use = <T>(
        fn: (client: SQSClient) => T,
      ): Effect.Effect<Awaited<T>, SQSEffectError, never> =>
        Effect.gen(function* () {
          const result = yield* Effect.try({
            try: () => fn(client),
            catch: (error) =>
              new SQSEffectError({
                cause: error,
                message:
                  error instanceof Error ? error.message : "Unknown error in SQS Effect Client",
              }),
          })
          if (result instanceof Promise) {
            return yield* Effect.tryPromise({
              try: () => result,
              catch: (e) =>
                new SQSEffectError({
                  cause: e,
                  message:
                    e instanceof Error ? e.message : "Unknown error in SQS Effect Client (Async)",
                }),
            })
          }
          return result
        })

      return {
        use,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
