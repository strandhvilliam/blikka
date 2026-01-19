import { Layer } from "effect";
import { UploadFlowApiService } from "./trpc/routers/upload-flow/service";
import { ContactSheetsApiService } from "./trpc/routers/contact-sheets/service";
import { ValidationsApiService } from "./trpc/routers/validations/service";
import { ParticipantsApiService } from "./trpc/routers/participants/service";
import { CompetitionClassesApiService } from "./trpc/routers/competition-classes/service";
import { RulesApiService } from "./trpc/routers/rules/service";
import { MarathonApiService } from "./trpc/routers/marathons/service";
import { UsersApiService } from "./trpc/routers/users/service";
import { ExportsApiService } from "./trpc/routers/exports/service";
import { JuryApiService } from "./trpc/routers/jury/service";
import { SponsorsApiService } from "./trpc/routers/sponsors/service";
import { ZipFilesApiService } from "./trpc/routers/zip-files/service";

export const ApiV2Layer = Layer.mergeAll(
  UploadFlowApiService.Default,
  ContactSheetsApiService.Default,
  ValidationsApiService.Default,
  ParticipantsApiService.Default,
  CompetitionClassesApiService.Default,
  RulesApiService.Default,
  MarathonApiService.Default,
  UsersApiService.Default,
  ExportsApiService.Default,
  JuryApiService.Default,
  SponsorsApiService.Default,
  ZipFilesApiService.Default,
);
