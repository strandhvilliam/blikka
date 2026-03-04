import { Effect, Layer, ServiceMap } from "effect"
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
import { ContactSheetsQueries } from "./queries/contact-sheets.queries"
import { ExportsQueries } from "./queries/exports.queries"
import { ZippedSubmissionsQueries } from "./queries/zipped-submissions.queries"
import { VotingQueries } from "./queries/voting.queries"

export class Database extends ServiceMap.Service<Database>()("@blikka/db/database", {
  make: Effect.gen(function* () {
    const usersQueries = yield* UsersQueries
    const validationsQueries = yield* ValidationsQueries
    const submissionsQueries = yield* SubmissionsQueries
    const sponsorsQueries = yield* SponsorsQueries
    const rulesQueries = yield* RulesQueries
    const juryQueries = yield* JuryQueries
    const marathonsQueries = yield* MarathonsQueries
    const topicsQueries = yield* TopicsQueries
    const deviceGroupsQueries = yield* DeviceGroupsQueries
    const competitionClassesQueries = yield* CompetitionClassesQueries
    const participantsQueries = yield* ParticipantsQueries
    const contactSheetsQueries = yield* ContactSheetsQueries
    const exportsQueries = yield* ExportsQueries
    const zippedSubmissionsQueries = yield* ZippedSubmissionsQueries
    const votingQueries = yield* VotingQueries

    return {
      usersQueries,
      validationsQueries,
      submissionsQueries,
      sponsorsQueries,
      rulesQueries,
      juryQueries,
      marathonsQueries,
      topicsQueries,
      deviceGroupsQueries,
      competitionClassesQueries,
      participantsQueries,
      contactSheetsQueries,
      exportsQueries,
      zippedSubmissionsQueries,
      votingQueries,
    } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        UsersQueries.layer,
        ValidationsQueries.layer,
        SubmissionsQueries.layer,
        SponsorsQueries.layer,
        RulesQueries.layer,
        JuryQueries.layer,
        MarathonsQueries.layer,
        TopicsQueries.layer,
        DeviceGroupsQueries.layer,
        CompetitionClassesQueries.layer,
        ParticipantsQueries.layer,
        ContactSheetsQueries.layer,
        ExportsQueries.layer,
        ZippedSubmissionsQueries.layer,
        VotingQueries.layer,
      ),
    ),
  )
}
