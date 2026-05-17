import { Config, Context, Effect, Layer, Option } from 'effect'

export interface AwsSdkStaticCredentials {
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly sessionToken?: string
}

export interface AwsSdkResolvedConfig {
  readonly region: string
  readonly credentials: AwsSdkStaticCredentials | undefined
}

/** Options shape accepted by `@aws-sdk/client-*` constructors for region + optional static keys. */
export function awsSdkClientConstructorOptions(config: AwsSdkResolvedConfig): {
  region: string
  credentials?: AwsSdkStaticCredentials
} {
  return {
    region: config.region,
    ...(config.credentials !== undefined ? { credentials: config.credentials } : {}),
  }
}

export class AwsSdkConfig extends Context.Service<AwsSdkConfig>()('@blikka/aws/aws-sdk-config', {
  make: Effect.gen(function* () {
    const region = yield* Config.string('AWS_REGION')
    const accessKeyId = yield* Config.option(Config.string('AWS_ACCESS_KEY_ID'))
    const secretAccessKey = yield* Config.option(Config.string('AWS_SECRET_ACCESS_KEY'))
    const sessionToken = yield* Config.option(Config.string('AWS_SESSION_TOKEN'))

    const credentials: AwsSdkStaticCredentials | undefined =
      Option.isSome(accessKeyId) && Option.isSome(secretAccessKey)
        ? {
            accessKeyId: accessKeyId.value,
            secretAccessKey: secretAccessKey.value,
            ...(Option.isSome(sessionToken) ? { sessionToken: sessionToken.value } : {}),
          }
        : undefined

    return {
      region,
      credentials,
    } satisfies AwsSdkResolvedConfig
  }),
}) {}

export const AwsSdkConfigLayer = Layer.effect(AwsSdkConfig, AwsSdkConfig.make)
