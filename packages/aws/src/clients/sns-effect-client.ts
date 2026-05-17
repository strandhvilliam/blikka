import { SNSClient } from '@aws-sdk/client-sns'
import { Console, Effect, Layer, Schema, Context } from 'effect'
import { AwsSdkConfig, AwsSdkConfigLayer, awsSdkClientConstructorOptions } from '../aws-sdk-config'

export class SNSEffectError extends Schema.TaggedErrorClass<SNSEffectError>()('SNSEffectError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SNSEffectClient extends Context.Service<
  SNSEffectClient,
  {
    /**
     * Wrapper around the SNS client to be usable in Effect contexts.
     */
    readonly use: <T>(
      fn: (client: SNSClient) => T,
    ) => Effect.Effect<Awaited<T>, SNSEffectError, never>
  }
>()('@blikka/aws/sns-client') {}

const makeSNSEffectClient = Effect.gen(function* () {
  const aws = yield* AwsSdkConfig

  const client = yield* Effect.acquireRelease(
    Effect.sync(() => new SNSClient(awsSdkClientConstructorOptions(aws))),
    (client) =>
      Effect.sync(() => {
        Console.log('Shutting down SNS client')
        client.destroy()
      }),
  )
  const use = <T>(fn: (client: SNSClient) => T): Effect.Effect<Awaited<T>, SNSEffectError, never> =>
    Effect.gen(function* () {
      const result = yield* Effect.try({
        try: () => fn(client),
        catch: (error) =>
          new SNSEffectError({
            cause: error,
            message: error instanceof Error ? error.message : 'Unknown error in SNS Effect Client',
          }),
      })
      if (result instanceof Promise) {
        return yield* Effect.tryPromise({
          try: () => result,
          catch: (e) =>
            new SNSEffectError({
              cause: e,
              message:
                e instanceof Error ? e.message : 'Unknown error in SNS Effect Client (Async)',
            }),
        })
      }
      return result
    })

  return SNSEffectClient.of({
    use,
  })
})

export const SNSEffectClientLayer = Layer.effect(SNSEffectClient, makeSNSEffectClient).pipe(
  Layer.provide(AwsSdkConfigLayer),
)
