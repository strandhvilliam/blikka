import { Layer } from 'effect'
import { CompetitionClassesRepositoryLayer } from './repositories/competition-classes.repository'
import { ContactSheetsRepositoryLayer } from './repositories/contact-sheets.repository'
import { DeviceGroupsRepositoryLayer } from './repositories/device-groups.repository'
import { ExportsRepositoryLayer } from './repositories/exports.repository'
import { JuryRepositoryLayer } from './repositories/jury.repository'
import { MarathonsRepositoryLayer } from './repositories/marathons.repository'
import { ParticipantsRepositoryLayer } from './repositories/participants.repository'
import { RulesRepositoryLayer } from './repositories/rules.repository'
import { SponsorsRepositoryLayer } from './repositories/sponsors.repository'
import { SubmissionsRepositoryLayer } from './repositories/submissions.repository'
import { TopicsRepositoryLayer } from './repositories/topics.repository'
import { UsersRepositoryLayer } from './repositories/users.repository'
import { ValidationsRepositoryLayer } from './repositories/validations.repository'
import { VotingRepositoryLayer } from './repositories/voting.repository'
import { ZippedSubmissionsRepositoryLayer } from './repositories/zipped-submissions.repository'

export const DbLayer = Layer.mergeAll(
  UsersRepositoryLayer,
  ValidationsRepositoryLayer,
  SubmissionsRepositoryLayer,
  SponsorsRepositoryLayer,
  RulesRepositoryLayer,
  JuryRepositoryLayer,
  MarathonsRepositoryLayer,
  TopicsRepositoryLayer,
  DeviceGroupsRepositoryLayer,
  CompetitionClassesRepositoryLayer,
  ParticipantsRepositoryLayer,
  ContactSheetsRepositoryLayer,
  ExportsRepositoryLayer,
  ZippedSubmissionsRepositoryLayer,
  VotingRepositoryLayer,
)
