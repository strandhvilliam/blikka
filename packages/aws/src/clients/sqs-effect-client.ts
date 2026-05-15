import { SQSClient } from "@aws-sdk/client-sqs"
import { Console, Context, Effect, Layer, Schema } from "effect"
import { AwsSdkConfig, AwsSdkConfigLayer, awsSdkClientConstructorOptions } from "../aws-sdk-config"

export class SQSEffectError extends Schema.TaggedErrorClass<SQSEffectError>()("SQSEffectError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SQSEffectClient extends Context.Service<
  SQSEffectClient,
  {
    /**
     * Wrapper around the SQS client to be usable as an Effect and closes the client on release.
     */
    readonly use: <T>(
      fn: (client: SQSClient) => T,
    ) => Effect.Effect<Awaited<T>, SQSEffectError, never>
  }
>()("@blikka/aws/sqs-effect-client") {}

const makeSQSEffectClient = Effect.gen(function* () {
  const aws = yield* AwsSdkConfig

  const client = yield* Effect.acquireRelease(
    Effect.sync(() => new SQSClient(awsSdkClientConstructorOptions(aws))),
    (client) =>
      Effect.sync(() => {
        Console.log("Shutting down SQS client")
        client.destroy()
      }),
  )

  const use = <T>(fn: (client: SQSClient) => T): Effect.Effect<Awaited<T>, SQSEffectError, never> =>
    Effect.gen(function* () {
      const result = yield* Effect.try({
        try: () => fn(client),
        catch: (error) =>
          new SQSEffectError({
            cause: error,
            message: "SQS.use error (Sync)",
          }),
      })
      if (result instanceof Promise) {
        return yield* Effect.tryPromise({
          try: () => result,
          catch: (e) =>
            new SQSEffectError({
              cause: e,
              message: "SQS.use error (Async)",
            }),
        })
      }
      return result
    })

  yield* Effect.addFinalizer(() => Console.log("Shutting down SQS client"))

  return SQSEffectClient.of({
    use,
  })
})

export const SQSEffectClientLayer = Layer.effect(SQSEffectClient, makeSQSEffectClient).pipe(
  Layer.provide(AwsSdkConfigLayer),
)
