import "server-only"
import { Layer, ManagedRuntime, ConfigError } from "effect"
import { DrizzleClient, Database } from "@blikka/db"
import { EmailService } from "@blikka/email"
import { RedisClient } from "@blikka/redis"
import { NodeContext } from "@effect/platform-node"
import { PubSubService, RunStateService } from "@blikka/pubsub"
import { S3Service } from "@blikka/s3"
import { UploadSessionRepository } from "@blikka/kv-store"
import { ValidationEngine } from "@blikka/validation"
import { SharpImageService, ContactSheetBuilder } from "@blikka/image-manipulation"
import { ExifParser } from "@blikka/exif-parser"
import { SMSService } from "@blikka/sms"

// Core layer with all common services
export const CoreLayer = Layer.mergeAll(
  DrizzleClient.Default,
  Database.Default,
  EmailService.Default,
  RedisClient.Default,
  PubSubService.Default,
  ValidationEngine.Default,
  S3Service.Default,
  UploadSessionRepository.Default,
  SharpImageService.Default,
  ContactSheetBuilder.Default,
  ExifParser.Default,
  RunStateService.Default,
  SMSService.Default,
)

// Derive CoreServices type from the CoreLayer
export type CoreServices = Layer.Layer.Success<typeof CoreLayer>

// Type for additional layers consumers can provide
export type AppRuntime<TAdditional = never> = ManagedRuntime.ManagedRuntime<
  CoreServices | TAdditional,
  never
>

export interface RuntimeConfig<TAdditional = never> {
  /** Additional layers to merge (e.g., AuthLayer, TelemetryLayer, ApiLayer) */
  additionalLayers?: Layer.Layer<TAdditional, any, any>
}

export function createRuntime<TAdditional = never>(
  config: RuntimeConfig<TAdditional> = {}
): AppRuntime<TAdditional> {
  const MainLayer = Layer.mergeAll(
    CoreLayer,
    ...(config.additionalLayers ? [config.additionalLayers] : [])
  ).pipe(
    Layer.provide(NodeContext.layer),
    Layer.catchAll((error) => {
      if (ConfigError.isConfigError(error)) {
        console.error("ConfigError", error)
        return Layer.die(error)
      }
      return Layer.fail(error)
    })
  ) as Layer.Layer<CoreServices | TAdditional, never, never>

  return ManagedRuntime.make(MainLayer)
}
