import "server-only"
import { Layer } from "effect"
import { createRuntime, type CoreServices } from "@blikka/runtime"
import { AuthLayer } from "./auth/server"
import { TelemetryLayer } from "@blikka/telemetry"
import { ApiLayer } from "@blikka/api/trpc"
import type { BetterAuthService } from "@blikka/auth"

const AppSpecificLayers = Layer.mergeAll(AuthLayer, ApiLayer, TelemetryLayer("blikka-dev-web"))

export const serverRuntime = createRuntime({
  additionalLayers: AppSpecificLayers,
})

type ApiServices = Layer.Success<typeof ApiLayer>
type TelemetryServices = Layer.Success<ReturnType<typeof TelemetryLayer>>

export type RuntimeDependencies =
  | CoreServices
  | ApiServices
  | BetterAuthService
  | TelemetryServices
