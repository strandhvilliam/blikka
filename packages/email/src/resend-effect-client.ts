import { Config, Effect, Layer, Schema, Context } from 'effect'
import { Resend } from 'resend'

export class ResendEffectError extends Schema.TaggedErrorClass<ResendEffectError>()(
  'ResendEffectError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ResendEffectClient extends Context.Service<
  ResendEffectClient,
  {
    readonly use: <T>(fn: (client: Resend) => T) => Effect.Effect<Awaited<T>, ResendEffectError>
  }
>()('@blikka/email/resend-client') {}

const makeResendEffectClient = Effect.gen(function* () {
  const apiKey = yield* Config.string('RESEND_API_KEY')
  const resend = new Resend(apiKey)

  const use = <T>(fn: (client: Resend) => T): Effect.Effect<Awaited<T>, ResendEffectError> =>
    Effect.gen(function* () {
      const result = yield* Effect.try({
        try: () => fn(resend),
        catch: (error) =>
          new ResendEffectError({
            cause: error,
            message:
              error instanceof Error ? error.message : 'Unknown error in ResendEffectClient.use',
          }),
      })
      if (result instanceof Promise) {
        return yield* Effect.tryPromise({
          try: () => result,
          catch: (e) =>
            new ResendEffectError({
              cause: e,
              message:
                e instanceof Error ? e.message : 'Unknown error in ResendEffectClient.use (Async)',
            }),
        })
      }
      return result
    })

  return ResendEffectClient.of({
    use,
  })
})

export const ResendEffectClientLayer = Layer.effect(ResendEffectClient, makeResendEffectClient)
