import "server-only"
import { Layer, ManagedRuntime, ConfigError } from "effect"
import { DrizzleClient, Database } from "@blikka/db"
import { EmailService } from "@blikka/email"
import { RedisClient } from "@blikka/redis"
import { AuthLayer } from "./auth/server"
import { NodeContext } from "@effect/platform-node"
import { PubSubService, RunStateService } from "@blikka/pubsub"
import { S3Service } from "@blikka/s3"
import { UploadSessionRepository } from "@blikka/kv-store"
import { TelemetryLayer } from "@blikka/telemetry"
import { ValidationEngine } from "@blikka/validation"
import { SharpImageService, ContactSheetBuilder } from "@blikka/image-manipulation"
import { ExifParser } from "@blikka/exif-parser"

const MainLayer = Layer.mergeAll(
  DrizzleClient.Default,
  Database.Default,
  EmailService.Default,
  RedisClient.Default,
  AuthLayer,
  PubSubService.Default,
  ValidationEngine.Default,
  S3Service.Default,
  UploadSessionRepository.Default,
  SharpImageService.Default,
  ContactSheetBuilder.Default,
  ExifParser.Default,
  RunStateService.Default,
  TelemetryLayer("blikka-dev-web-v2")
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

export const serverRuntime = ManagedRuntime.make(MainLayer)

export type RuntimeDependencies = ManagedRuntime.ManagedRuntime.Context<typeof serverRuntime>
