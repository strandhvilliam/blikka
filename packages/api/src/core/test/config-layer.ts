import { ConfigProvider, Layer } from 'effect'

export const configLayerFromEnv = (env: Record<string, string>) =>
  ConfigProvider.layer(ConfigProvider.fromUnknown(env))
