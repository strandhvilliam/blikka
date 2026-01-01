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
  RunStateService.Default
)

export interface RuntimeConfig {
  /** Additional layers to merge (e.g., AuthLayer, TelemetryLayer, ApiV2Layer) */
  additionalLayers?: Layer.Layer<any, any, any>
}

export function createRuntime(config: RuntimeConfig = {}) {
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
  )

  return ManagedRuntime.make(MainLayer)
}

// Re-export for convenience
export { ManagedRuntime } from "effect"

