import "server-only"
import { Layer } from "effect"
import { createRuntime, type ManagedRuntime } from "@blikka/runtime"
import { AuthLayer } from "./auth/server"
import { TelemetryLayer } from "@blikka/telemetry"
import { ApiV2Layer } from "@blikka/api-v2/trpc"

const AppSpecificLayers = Layer.mergeAll(
  AuthLayer,
  ApiV2Layer,
  TelemetryLayer("blikka-dev-web-v2")
)

export const serverRuntime = createRuntime({
  additionalLayers: AppSpecificLayers
})

export type RuntimeDependencies = ManagedRuntime.ManagedRuntime.Context<typeof serverRuntime>
