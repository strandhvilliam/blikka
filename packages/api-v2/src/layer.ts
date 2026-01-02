import { Layer } from "effect"
import { UploadFlowService } from "./trpc/routers/upload-flow/service"
import { ContactSheetsApiService } from "./trpc/routers/contact-sheets/service"
import { ValidationsApiService } from "./trpc/routers/validations/service"
import { ParticipantsApiService } from "./trpc/routers/participants/service"

export const ApiV2Layer = Layer.mergeAll(
  UploadFlowService.Default,
  ContactSheetsApiService.Default,
  ValidationsApiService.Default,
  ParticipantsApiService.Default
)
