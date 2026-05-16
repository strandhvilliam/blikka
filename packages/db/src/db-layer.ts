import { Layer } from "effect";
import { CompetitionClassesRepository } from "./repositories/competition-classes.repository";
import { ContactSheetsRepository } from "./repositories/contact-sheets.repository";
import { DeviceGroupsRepository } from "./repositories/device-groups.repository";
import { ExportsRepository } from "./repositories/exports.repository";
import { JuryRepository } from "./repositories/jury.repository";
import { MarathonsRepository } from "./repositories/marathons.repository";
import { ParticipantsRepository } from "./repositories/participants.repository";
import { RulesRepository } from "./repositories/rules.repository";
import { SponsorsRepository } from "./repositories/sponsors.repository";
import { SubmissionsRepository } from "./repositories/submissions.repository";
import { TopicsRepository } from "./repositories/topics.repository";
import { UsersRepository } from "./repositories/users.repository";
import { ValidationsRepository } from "./repositories/validations.repository";
import { VotingRepository } from "./repositories/voting.repository";
import { ZippedSubmissionsRepository } from "./repositories/zipped-submissions.repository";

export const DbLayer = Layer.mergeAll(
  UsersRepository.layer,
  ValidationsRepository.layer,
  SubmissionsRepository.layer,
  SponsorsRepository.layer,
  RulesRepository.layer,
  JuryRepository.layer,
  MarathonsRepository.layer,
  TopicsRepository.layer,
  DeviceGroupsRepository.layer,
  CompetitionClassesRepository.layer,
  ParticipantsRepository.layer,
  ContactSheetsRepository.layer,
  ExportsRepository.layer,
  ZippedSubmissionsRepository.layer,
  VotingRepository.layer,
);
