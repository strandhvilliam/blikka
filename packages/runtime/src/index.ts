import { Layer, ManagedRuntime } from "effect"
import { DrizzleClient, Database } from "@blikka/db"
import { EmailService } from "@blikka/email"
import { RedisClient } from "@blikka/redis"
import { NodeServices } from "@effect/platform-node"
import { PubSubService } from "@blikka/pubsub"
import { S3ServiceLayer, SQSServiceLayer, SMSServiceLayer } from "@blikka/aws"
import { UploadSessionRepositoryLayer } from "@blikka/kv-store"
import { ValidationEngine } from "@blikka/validation"
import { SharpImageService, ContactSheetBuilder, ExifParser } from "@blikka/image-manipulation"
import { RealtimeEventsService } from "@blikka/realtime"

// Core layer with all common services
export const CoreLayer = Layer.mergeAll(
  DrizzleClient.layer,
  Database.layer,
  EmailService.layer,
  RedisClient.layer,
  PubSubService.layer,
  ValidationEngine.layer,
  S3ServiceLayer,
  SQSServiceLayer,
  UploadSessionRepositoryLayer,
  SharpImageService.layer,
  ContactSheetBuilder.layer,
  ExifParser.layer,
  RealtimeEventsService.layer,
  SMSServiceLayer,
)

// Derive CoreServices type from the CoreLayer
export type CoreServices = Layer.Success<typeof CoreLayer>

// Type for additional layers consumers can provide
export type AppRuntime<TAdditional = never> = ManagedRuntime.ManagedRuntime<
  CoreServices | TAdditional,
  never
>

export interface RuntimeConfig<TAdditional = never> {
  /** Additional layers to merge (e.g., AuthLayer, TelemetryLayer, ApiLayer) */
  additionalLayers?: Layer.Layer<TAdditional, unknown, unknown>
}

export function createRuntime<TAdditional = never>(
  config: RuntimeConfig<TAdditional> = {},
): AppRuntime<TAdditional> {
  const MainLayer = Layer.mergeAll(
    CoreLayer,
    ...(config.additionalLayers ? [config.additionalLayers] : []),
  ).pipe(Layer.provide(NodeServices.layer), Layer.orDie) as Layer.Layer<
    CoreServices | TAdditional,
    never,
    never
  >

  return ManagedRuntime.make(MainLayer)
}
