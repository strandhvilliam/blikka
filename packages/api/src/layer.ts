import { Layer } from "effect";
import { UploadFlowApiService } from "./trpc/routers/upload-flow/service";
import { ContactSheetsApiService } from "./trpc/routers/contact-sheets/service";
import { ValidationsApiService } from "./trpc/routers/validations/service";
import { ParticipantsApiService } from "./trpc/routers/participants/service";
import { TopicsApiService } from "./trpc/routers/topics/service";
import { DeviceGroupsApiService } from "./trpc/routers/device-groups/service";
import { CompetitionClassesApiService } from "./trpc/routers/competition-classes/service";
import { RulesApiService } from "./trpc/routers/rules/service";
import { MarathonApiService } from "./trpc/routers/marathons/service";
import { UsersApiService } from "./trpc/routers/users/service";
import { ExportsApiService } from "./trpc/routers/exports/service";
import { JuryApiService } from "./trpc/routers/jury/service";
import { SponsorsApiService } from "./trpc/routers/sponsors/service";
import { ZipFilesApiService } from "./trpc/routers/zip-files/service";
import { VotingApiService } from "./trpc/routers/voting/service";

export const ApiLayer = Layer.mergeAll(
  UploadFlowApiService.layer,
  ContactSheetsApiService.layer,
  ValidationsApiService.layer,
  ParticipantsApiService.layer,
  TopicsApiService.layer,
  DeviceGroupsApiService.layer,
  CompetitionClassesApiService.layer,
  RulesApiService.layer,
  MarathonApiService.layer,
  UsersApiService.layer,
  ExportsApiService.layer,
  JuryApiService.layer,
  SponsorsApiService.layer,
  ZipFilesApiService.layer,
  VotingApiService.layer,
);
