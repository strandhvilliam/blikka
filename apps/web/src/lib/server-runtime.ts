import 'server-only'
import { Layer } from 'effect'
import { createRuntime, type CoreServices } from '@blikka/runtime'
import { AuthLayer } from './auth/layer'
// import { TelemetryLayer } from "@blikka/telemetry"
import { ApiLayer } from '@blikka/api/trpc'
import type { BetterAuthService } from '@blikka/auth'

const AppSpecificLayers = Layer.mergeAll(AuthLayer, ApiLayer)

export const serverRuntime = createRuntime({
  additionalLayers: AppSpecificLayers,
})

type ApiLayerServices = Layer.Success<typeof ApiLayer>
// type TelemetryServices = Layer.Success<ReturnType<typeof TelemetryLayer>>

export type RuntimeDependencies = CoreServices | ApiLayerServices | BetterAuthService
