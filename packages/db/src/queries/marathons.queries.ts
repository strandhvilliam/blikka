import { Effect, Option } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { Database } from "../database"
import { eq, inArray } from "drizzle-orm"
import {
  marathons,
  participants,
  validationResults,
  submissions,
  zippedSubmissions,
  juryInvitations,
} from "../schema"
import { topics } from "../schema"
import { competitionClasses } from "../schema"
import { deviceGroups } from "../schema"
import { ruleConfigs } from "../schema"
import { sponsors } from "../schema"
import { participantVerifications } from "../schema"
import type { NewMarathon } from "../types"
import { SqlError } from "@effect/sql/SqlError"

export class MarathonsQueries extends Effect.Service<MarathonsQueries>()(
  "@blikka/db/marathons-queries",
  {
    dependencies: [DrizzleClient.Default],
    effect: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getMarathons = Effect.fn("MarathonsQueries.getMarathons")(function* () {
        return yield* db.query.marathons.findMany({
          with: {
            competitionClasses: true,
            topics: true,
          },
        })
      })

      const getMarathonById = Effect.fn("MarathonsQueries.getMarathonById")(function* ({
        id,
      }: {
        id: number
      }) {
        const result = yield* db.query.marathons.findFirst({
          where: eq(marathons.id, id),
        })
        return Option.fromNullable(result)
      })

      const getMarathonByDomain = Effect.fn("MarathonsQueries.getMarathonByDomain")(function* ({
        domain,
      }: {
        domain: string
      }) {
        const result = yield* db.query.marathons.findFirst({
          where: eq(marathons.domain, domain),
        })
        return Option.fromNullable(result)
      })

      const getMarathonByDomainWithOptions = Effect.fn(
        "MarathonsQueries.getMarathonByDomainWithOptions"
      )(function* ({ domain }: { domain: string }) {
        const result = yield* db.query.marathons.findFirst({
          where: eq(marathons.domain, domain),
          with: {
            competitionClasses: true,
            topics: true,
            deviceGroups: true,
            sponsors: true,
            ruleConfigs: true,
          },
        })
        return Option.fromNullable(result)
      })

      const createMarathon = Effect.fn("MarathonsQueries.createMarathon")(function* ({
        data,
      }: {
        data: NewMarathon
      }) {
        const [result] = yield* db.insert(marathons).values(data).returning()
        if (!result) {
          return yield* new SqlError({
            cause: "Failed to create marathon",
          })
        }
        return result
      })

      const updateMarathon = Effect.fn("MarathonsQueries.updateMarathon")(function* ({
        id,
        data,
      }: {
        id: number
        data: Partial<NewMarathon>
      }) {
        const [result] = yield* db
          .update(marathons)
          .set(data)
          .where(eq(marathons.id, id))
          .returning()

        if (!result) {
          return yield* new SqlError({
            cause: "Failed to create marathon",
          })
        }
        return result
      })

      const updateMarathonByDomain = Effect.fn("MarathonsQueries.updateMarathonByDomain")(
        function* ({ domain, data }: { domain: string; data: Partial<NewMarathon> }) {
          if (!data.updatedAt) {
            data.updatedAt = new Date().toISOString()
          }

          const [result] = yield* db
            .update(marathons)
            .set(data)
            .where(eq(marathons.domain, domain))
            .returning()

          if (!result) {
            return yield* new SqlError({
              cause: "Failed to update marathon by domain",
            })
          }

          return result
        }
      )

      const deleteMarathon = Effect.fn("MarathonsQueries.deleteMarathon")(function* ({
        id,
      }: {
        id: number
      }) {
        const [result] = yield* db.delete(marathons).where(eq(marathons.id, id)).returning()

        if (!result) {
          return yield* new SqlError({
            cause: "Failed to delete marathon",
          })
        }
        return result
      })

      const resetMarathon = Effect.fn("MarathonsQueries.resetMarathon")(function* ({
        id,
      }: {
        id: number
      }) {
        const marathon = yield* db.query.marathons.findFirst({
          where: eq(marathons.id, id),
        })

        if (!marathon) {
          return yield* new SqlError({
            cause: "Marathon not found",
          })
        }

        const marathonParticipants = yield* db
          .select({ id: participants.id })
          .from(participants)
          .where(eq(participants.marathonId, id))

        const participantIds = marathonParticipants.map((p) => p.id)
        if (participantIds.length > 0) {
          yield* db
            .delete(validationResults)
            .where(inArray(validationResults.participantId, participantIds))
        }
        if (participantIds.length > 0) {
          yield* db
            .delete(participantVerifications)
            .where(inArray(participantVerifications.participantId, participantIds))
        }
        yield* db.delete(submissions).where(eq(submissions.marathonId, id))

        yield* db.delete(zippedSubmissions).where(eq(zippedSubmissions.marathonId, id))
        yield* db.delete(participants).where(eq(participants.marathonId, id))
        yield* db.delete(juryInvitations).where(eq(juryInvitations.marathonId, id))
        yield* db.delete(topics).where(eq(topics.marathonId, id))
        yield* db.delete(competitionClasses).where(eq(competitionClasses.marathonId, id))
        yield* db.delete(deviceGroups).where(eq(deviceGroups.marathonId, id))
        yield* db.delete(ruleConfigs).where(eq(ruleConfigs.marathonId, id))
        yield* db.delete(sponsors).where(eq(sponsors.marathonId, id))
        yield* db
          .update(marathons)
          .set({
            setupCompleted: false,
            updatedAt: new Date().toISOString(),
            startDate: null,
            endDate: null,
            name: "",
            description: null,
            logoUrl: null,
            languages: "en",
            termsAndConditionsKey: null,
          })
          .where(eq(marathons.id, id))

        return { id }
      })
      return {
        getMarathons,
        getMarathonById,
        getMarathonByDomain,
        getMarathonByDomainWithOptions,
        createMarathon,
        updateMarathon,
        updateMarathonByDomain,
        deleteMarathon,
        resetMarathon,
      } as const
    }),
  }
) {}
