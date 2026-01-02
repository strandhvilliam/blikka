import { Layer } from "effect"
import { UploadFlowApiService } from "./trpc/routers/upload-flow/service"
import { ContactSheetsApiService } from "./trpc/routers/contact-sheets/service"
import { ValidationsApiService } from "./trpc/routers/validations/service"
import { ParticipantsApiService } from "./trpc/routers/participants/service"
import { CompetitionClassesApiService } from "./trpc/routers/competition-classes/service"
import { RulesApiService } from "./trpc/routers/rules/service"

export const ApiV2Layer = Layer.mergeAll(
  UploadFlowApiService.Default,
  ContactSheetsApiService.Default,
  ValidationsApiService.Default,
  ParticipantsApiService.Default,
  CompetitionClassesApiService.Default,
  RulesApiService.Default
)
