import { Layer } from 'effect'
import { UploadFlowServiceLayer } from './core/upload-flow/service'
import { UploadInitializerServiceLayer } from './core/upload-initializer/service'
import { ContactSheetsServiceLayer } from './core/contact-sheets/service'
import { ValidationsServiceLayer } from './core/validations/service'
import { ParticipantsServiceLayer } from './core/participants/service'
import { TopicsServiceLayer } from './core/topics/service'
import { DeviceGroupsServiceLayer } from './core/device-groups/service'
import { CompetitionClassesServiceLayer } from './core/competition-classes/service'
import { RulesServiceLayer } from './core/rules/service'
import { MarathonServiceLayer } from './core/marathons/service'
import { UsersServiceLayer } from './core/users/service'
import { ExportsServiceLayer } from './core/exports/service'
import { JuryServiceLayer } from './core/jury/service'
import { SponsorsServiceLayer } from './core/sponsors/service'
import { ZipFilesServiceLayer } from './core/zip-files/service'
import { VotingServiceLayer } from './core/voting/service'
import { SubmissionsServiceLayer } from './core/submissions/service'
import { SeedingServiceLayer } from './core/seeding/service'

export const ApiLayer = Layer.mergeAll(
  UploadInitializerServiceLayer,
  UploadFlowServiceLayer,
  ContactSheetsServiceLayer,
  ValidationsServiceLayer,
  ParticipantsServiceLayer,
  TopicsServiceLayer,
  DeviceGroupsServiceLayer,
  CompetitionClassesServiceLayer,
  RulesServiceLayer,
  MarathonServiceLayer,
  UsersServiceLayer,
  ExportsServiceLayer,
  JuryServiceLayer,
  SponsorsServiceLayer,
  ZipFilesServiceLayer,
  VotingServiceLayer,
  SubmissionsServiceLayer,
  SeedingServiceLayer,
)
