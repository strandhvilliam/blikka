import { Layer } from "effect"
import { UploadFlowService } from "./trpc/routers/upload-flow/service"
import { ContactSheetsService } from "./trpc/routers/contact-sheets/service"

export const ApiV2Layer = Layer.mergeAll(UploadFlowService.Default, ContactSheetsService.Default)
