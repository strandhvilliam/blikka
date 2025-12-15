import { Layer, ManagedRuntime, ConfigError } from "effect"
import { DrizzleClient, Database } from "@blikka/db"
import { EmailService } from "@blikka/email"
import { RedisClient } from "@blikka/redis"
import { AuthLayer } from "./auth/server"
import { NodeContext } from "@effect/platform-node"
import { PubSubService } from "@blikka/pubsub"
import { S3Service } from "@blikka/s3"
import { UploadKVRepository } from "@blikka/kv-store"

const MainLayer = Layer.mergeAll(
  DrizzleClient.Default,
  Database.Default,
  EmailService.Default,
  RedisClient.Default,
  AuthLayer,
  PubSubService.Default,
  S3Service.Default,
  UploadKVRepository.Default
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
