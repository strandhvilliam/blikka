import { Effect } from "effect"
import { UsersQueries } from "./queries/users.queries"
import { ValidationsQueries } from "./queries/validations.queries"
import { SubmissionsQueries } from "./queries/submissions.queries"
import { SponsorsQueries } from "./queries/sponsors.queries"
import { RulesQueries } from "./queries/rules.queries"
import { JuryQueries } from "./queries/jury.queries"
import { MarathonsQueries } from "./queries/marathons.queries"
import { TopicsQueries } from "./queries/topics.queries"
import { DeviceGroupsQueries } from "./queries/device-groups.queries"
import { CompetitionClassesQueries } from "./queries/competition-classes.queries"
import { ParticipantsQueries } from "./queries/participants.queries"

export class Database extends Effect.Service<Database>()("@blikka/db/database", {
  dependencies: [
    UsersQueries.Default,
    ValidationsQueries.Default,
    SubmissionsQueries.Default,
    SponsorsQueries.Default,
    RulesQueries.Default,
    JuryQueries.Default,
    MarathonsQueries.Default,
    TopicsQueries.Default,
    DeviceGroupsQueries.Default,
    CompetitionClassesQueries.Default,
    ParticipantsQueries.Default,
  ],
  effect: Effect.all({
    usersQueries: UsersQueries,
    validationsQueries: ValidationsQueries,
    submissionsQueries: SubmissionsQueries,
    sponsorsQueries: SponsorsQueries,
    rulesQueries: RulesQueries,
    juryQueries: JuryQueries,
    marathonsQueries: MarathonsQueries,
    topicsQueries: TopicsQueries,
    deviceGroupsQueries: DeviceGroupsQueries,
    competitionClassesQueries: CompetitionClassesQueries,
    participantsQueries: ParticipantsQueries,
  }),
}) {}
