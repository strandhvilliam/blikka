import { Layer } from "effect";
import { UploadFlowService } from "./core/upload-flow/service";
import { ContactSheetsService } from "./core/contact-sheets/service";
import { ValidationsService } from "./core/validations/service";
import { ParticipantsService } from "./core/participants/service";
import { TopicsService } from "./core/topics/service";
import { DeviceGroupsService } from "./core/device-groups/service";
import { CompetitionClassesService } from "./core/competition-classes/service";
import { RulesService } from "./core/rules/service";
import { MarathonService } from "./core/marathons/service";
import { UsersService } from "./core/users/service";
import { ExportsService } from "./core/exports/service";
import { JuryService } from "./core/jury/service";
import { SponsorsService } from "./core/sponsors/service";
import { ZipFilesService } from "./core/zip-files/service";
import { VotingService } from "./core/voting/service";
import { SubmissionsService } from "./core/submissions/service";

export const ApiLayer = Layer.mergeAll(
  UploadFlowService.layer,
  ContactSheetsService.layer,
  ValidationsService.layer,
  ParticipantsService.layer,
  TopicsService.layer,
  DeviceGroupsService.layer,
  CompetitionClassesService.layer,
  RulesService.layer,
  MarathonService.layer,
  UsersService.layer,
  ExportsService.layer,
  JuryService.layer,
  SponsorsService.layer,
  ZipFilesService.layer,
  VotingService.layer,
  SubmissionsService.layer,
);
