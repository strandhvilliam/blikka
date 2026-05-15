import { S3Client } from "@aws-sdk/client-s3"
import { Config, Console, Context, Effect, Schema, Layer } from "effect"

export class S3EffectError extends Schema.TaggedErrorClass<S3EffectError>()("S3EffectError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class S3EffectClient extends Context.Service<
  S3EffectClient,
  {
    /**
     * Wrapper around the S3 client to be usable as an Effect and closes the client on release.
     */
    readonly use: <T>(
      fn: (client: S3Client) => T,
    ) => Effect.Effect<Awaited<T>, S3EffectError, never>
  }
>()("@blikka/s3/s3-effect-client") {}

export const S3EffectClientLayer = Layer.effect(
  S3EffectClient,
  Effect.gen(function* () {
    const region = yield* Config.string("AWS_REGION")

    const client = yield* Effect.acquireRelease(
      Effect.sync(() => new S3Client({ region })),
      (client) =>
        Effect.sync(() => {
          Console.log("Shutting down S3 client")
          client.destroy()
        }),
    )

    const use = <T>(
      fn: (client: S3Client) => T,
    ): Effect.Effect<Awaited<T>, S3EffectError, never> =>
      Effect.gen(function* () {
        const result = yield* Effect.try({
          try: () => fn(client),
          catch: (error) =>
            new S3EffectError({
              cause: error,
              message: "S3.use error (Sync)",
            }),
        })
        if (result instanceof Promise) {
          return yield* Effect.tryPromise({
            try: () => result,
            catch: (e) =>
              new S3EffectError({
                cause: e,
                message: "S3.use error (Async)",
              }),
          })
        }
        return result
      })

    yield* Effect.addFinalizer(() => Console.log("Shutting down S3 client"))

    return S3EffectClient.of({
      use,
    })
  }),
)
