import "server-only"
import { Layer } from "effect"
import { createRuntime, type CoreServices } from "@blikka/runtime"
import { AuthLayer } from "./auth/server"
import { TelemetryLayer } from "@blikka/telemetry"
import { ApiV2Layer } from "@blikka/api-v2/trpc"
import type { BetterAuthService } from "@blikka/auth"

const AppSpecificLayers = Layer.mergeAll(AuthLayer, ApiV2Layer, TelemetryLayer("blikka-dev-web"))

export const serverRuntime = createRuntime({
  additionalLayers: AppSpecificLayers,
})

type ApiV2Services = Layer.Layer.Success<typeof ApiV2Layer>
type TelemetryServices = Layer.Layer.Success<ReturnType<typeof TelemetryLayer>>

export type RuntimeDependencies =
  | CoreServices
  | ApiV2Services
  | BetterAuthService
  | TelemetryServices
