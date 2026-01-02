import { Effect, Option } from "effect"
import { type CompetitionClass, Database, type NewCompetitionClass } from "@blikka/db"
import { CompetitionClassApiError } from "./schemas"

export class CompetitionClassesApiService extends Effect.Service<CompetitionClassesApiService>()(
  "@blikka/api-v2/competition-classes-api-service",
  {
    accessors: true,
    dependencies: [Database.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database

      const createCompetitionClass = Effect.fn(
        "CompetitionClassesApiService.createCompetitionClass"
      )(function* ({
        data,
        domain,
      }: {
        data: Omit<NewCompetitionClass, "marathonId">
        domain: string
      }) {
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain,
        })

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Marathon not found for domain ${domain}`,
            })
          )
        }

        return yield* db.competitionClassesQueries.createCompetitionClass({
          data: {
            ...data,
            marathonId: marathon.value.id,
            topicStartIndex: data.topicStartIndex ?? 0,
          },
        })
      })

      const updateCompetitionClass = Effect.fn(
        "CompetitionClassesApiService.updateCompetitionClass"
      )(function* ({
        id,
        data,
        domain,
      }: {
        id: number
        data: Partial<NewCompetitionClass>
        domain: string
      }) {
        const competitionClass = yield* db.competitionClassesQueries.getCompetitionClassById({
          id,
        })

        if (Option.isNone(competitionClass)) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class not found with id ${id}`,
            })
          )
        }

        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain,
        })

        if (Option.isNone(marathon) || marathon.value.id !== competitionClass.value.marathonId) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class does not belong to domain ${domain}`,
            })
          )
        }

        return yield* db.competitionClassesQueries.updateCompetitionClass({
          id,
          data,
        })
      })

      const deleteCompetitionClass = Effect.fn(
        "CompetitionClassesApiService.deleteCompetitionClass"
      )(function* ({ id, domain }: { id: number; domain: string }) {
        const competitionClass = yield* db.competitionClassesQueries.getCompetitionClassById({
          id,
        })

        if (Option.isNone(competitionClass)) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class not found with id ${id}`,
            })
          )
        }

        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain,
        })

        if (Option.isNone(marathon) || marathon.value.id !== competitionClass.value.marathonId) {
          return yield* Effect.fail(
            new CompetitionClassApiError({
              message: `Competition class does not belong to domain ${domain}`,
            })
          )
        }

        return yield* db.competitionClassesQueries.deleteCompetitionClass({ id })
      })

      return {
        createCompetitionClass,
        updateCompetitionClass,
        deleteCompetitionClass,
      } as const
    }),
  }
) {}
