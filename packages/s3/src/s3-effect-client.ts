import { S3Client } from "@aws-sdk/client-s3"
import { Config, Console, ServiceMap, Effect, Schema, Layer } from "effect"

export class S3EffectError extends Schema.TaggedErrorClass<S3EffectError>()(
  "S3EffectError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export class S3EffectClient extends ServiceMap.Service<S3EffectClient>()(
  "@blikka/packages/s3-service/s3-effect-client",
  {
    make: Effect.gen(function* () {
      const region = yield* Config.string("AWS_REGION")

      const client = new S3Client({ region })
      const use = <T>(
        fn: (client: S3Client) => T
      ): Effect.Effect<Awaited<T>, S3EffectError, never> =>
        Effect.gen(function* () {
          const result = yield* Effect.try({
            try: () => fn(client),
            catch: (error) =>
              new S3EffectError({
                cause: error,
                message:
                  error instanceof Error ? error.message : "Unknown error in S3 Effect Client",
              }),
          })
          if (result instanceof Promise) {
            return yield* Effect.tryPromise({
              try: () => result,
              catch: (e) =>
                new S3EffectError({
                  cause: e,
                  message:
                    e instanceof Error ? e.message : "Unknown error in S3 Effect Client (Async)",
                }),
            })
          }
          return result
        })

      yield* Effect.addFinalizer(() => Console.log("Shutting down S3 client"))

      return {
        use,
      }
    }),
  }
) {

  static readonly layer = Layer.effect(this, this.make)
}
