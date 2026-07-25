import 'server-only'
import { Layer } from 'effect'
import { createRuntime, type CoreServices } from '@blikka/runtime'
import { AuthLayer } from './auth/layer'
// import { TelemetryLayer } from "@blikka/telemetry"
import { ApiLayer } from '@blikka/api/trpc'

const AppLayer = Layer.mergeAll(AuthLayer, ApiLayer)

/** Single shared runtime for web server entrypoints (tRPC, auth, route handlers). */
export const serverRuntime = createRuntime({
  additionalLayers: AppLayer,
})

type AppLayerServices = Layer.Success<typeof AppLayer>
// type TelemetryServices = Layer.Success<ReturnType<typeof TelemetryLayer>>

export type RuntimeDependencies = CoreServices | AppLayerServices
