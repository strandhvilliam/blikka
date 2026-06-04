import { ECSClient } from '@aws-sdk/client-ecs'
import { Console, Context, Effect, Layer, Schema } from 'effect'

import { AwsSdkConfig, AwsSdkConfigLayer, awsSdkClientConstructorOptions } from '../aws-sdk-config'

export class ECSEffectError extends Schema.TaggedErrorClass<ECSEffectError>()('ECSEffectError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class ECSEffectClient extends Context.Service<
  ECSEffectClient,
  {
    /**
     * Wrapper around the ECS client to be usable as an Effect and closes the client on release.
     */
    readonly use: <T>(
      fn: (client: ECSClient) => T,
    ) => Effect.Effect<Awaited<T>, ECSEffectError, never>
  }
>()('@blikka/aws/ecs-effect-client') {}

const makeECSEffectClient = Effect.gen(function* () {
  const aws = yield* AwsSdkConfig

  const client = yield* Effect.acquireRelease(
    Effect.sync(() => new ECSClient(awsSdkClientConstructorOptions(aws))),
    (client) =>
      Effect.sync(() => {
        Console.log('Shutting down ECS client')
        client.destroy()
      }),
  )

  const use = <T>(fn: (client: ECSClient) => T): Effect.Effect<Awaited<T>, ECSEffectError, never> =>
    Effect.gen(function* () {
      const result = yield* Effect.try({
        try: () => fn(client),
        catch: (error) =>
          new ECSEffectError({
            cause: error,
            message: 'ECS.use error (Sync)',
          }),
      })
      if (result instanceof Promise) {
        return yield* Effect.tryPromise({
          try: () => result,
          catch: (error) =>
            new ECSEffectError({
              cause: error,
              message: 'ECS.use error (Async)',
            }),
        })
      }
      return result
    })

  yield* Effect.addFinalizer(() => Console.log('Shutting down ECS client'))

  return ECSEffectClient.of({
    use,
  })
})

export const ECSEffectClientLayer = Layer.effect(ECSEffectClient, makeECSEffectClient).pipe(
  Layer.provide(AwsSdkConfigLayer),
)
