import { Layer } from "effect"
import { UploadFlowService } from "./trpc/routers/upload-flow/service"

export const ApiV2Layer = Layer.mergeAll(
  UploadFlowService.Default
)

