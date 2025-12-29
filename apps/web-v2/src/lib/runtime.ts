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

const MainLayer = Layer.mergeAll(
  DrizzleClient.Default,
  Database.Default,
  EmailService.Default,
  RedisClient.Default,
  AuthLayer,
  PubSubService.Default,
  RunStateService.Default,
  S3Service.Default,
  UploadSessionRepository.Default,
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
