import { SNSClient } from "@aws-sdk/client-sns"
import { Config, Console, Data, Effect, Layer, Schema, ServiceMap } from "effect"

export class SNSEffectError extends Schema.TaggedErrorClass<SNSEffectError>()("SNSEffectError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
}

export class SNSEffectClient extends ServiceMap.Service<SNSEffectClient>()(
  "@blikka/sms/sns-client",
  {
    make: Effect.gen(function* () {
      const region = yield* Config.string("AWS_REGION")
      const accessKeyId = yield* Config.string("AWS_ACCESS_KEY_ID")
      const secretAccessKey = yield* Config.string("AWS_SECRET_ACCESS_KEY")

      const client = yield* Effect.acquireRelease(
        Effect.sync(() => new SNSClient({
          region, credentials: {
            accessKeyId,
            secretAccessKey,
          }
        })),
        (client) => Effect.sync(() => {
          Console.log("Shutting down SNS client")
          client.destroy()
        }
        ),
      )
      const use = <T>(
        fn: (client: SNSClient) => T,
      ): Effect.Effect<Awaited<T>, SNSEffectError, never> =>
        Effect.gen(function* () {
          const result = yield* Effect.try({
            try: () => fn(client),
            catch: (error) =>
              new SNSEffectError({
                cause: error,
                message:
                  error instanceof Error
                    ? error.message
                    : "Unknown error in SNS Effect Client",
              }),
          })
          if (result instanceof Promise) {
            return yield* Effect.tryPromise({
              try: () => result,
              catch: (e) =>
                new SNSEffectError({
                  cause: e,
                  message:
                    e instanceof Error
                      ? e.message
                      : "Unknown error in SNS Effect Client (Async)",
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
