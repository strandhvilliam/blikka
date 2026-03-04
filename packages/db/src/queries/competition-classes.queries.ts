import { Effect, Layer, Option, ServiceMap } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { competitionClasses, marathons } from "../schema"
import { eq } from "drizzle-orm"
import type { NewCompetitionClass } from "../types"
import { SqlError } from "@effect/sql/SqlError"

export class CompetitionClassesQueries extends ServiceMap.Service<CompetitionClassesQueries>()(
  "@blikka/db/competition-classes-queries",
  {
    make: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getCompetitionClassById = Effect.fn(
        "CompetitionClassesQueries.getCompetitionClassById"
      )(function* ({ id }: { id: number }) {
        const result = yield* db.query.competitionClasses.findFirst({
          where: eq(competitionClasses.id, id),
        })
        return Option.fromNullishOr(result)
      })

      const getCompetitionClassesByDomain = Effect.fn(
        "CompetitionClassesQueries.getCompetitionClassesByDomain"
      )(function* ({ domain }: { domain: string }) {
        const result = yield* db
          .select()
          .from(competitionClasses)
          .innerJoin(marathons, eq(competitionClasses.marathonId, marathons.id))
          .where(eq(marathons.domain, domain))

        return result.map((row) => row.competition_classes)
      })

      const createCompetitionClass = Effect.fn(
        "CompetitionClassesQueries.createCompetitionClass"
      )(function* ({ data }: { data: NewCompetitionClass }) {
        const [result] = yield* db
          .insert(competitionClasses)
          .values(data)
          .returning()
        if (!result) {
          return yield* Effect.fail(
            new SqlError({
              cause: "Failed to create competition class",
            })
          )
        }
        return result
      })

      const createMultipleCompetitionClasses = Effect.fn(
        "CompetitionClassesQueries.createMultipleCompetitionClasses"
      )(function* ({ data }: { data: NewCompetitionClass[] }) {
        const result = yield* db
          .insert(competitionClasses)
          .values(data)
          .returning()
        if (!result) {
          return yield* Effect.fail(
            new SqlError({
              cause: "Failed to create multiple competition classes",
            })
          )
        }
        return result
      })

      const updateCompetitionClass = Effect.fn(
        "CompetitionClassesQueries.updateCompetitionClass"
      )(function* ({
        id,
        data,
      }: {
        id: number
        data: Partial<NewCompetitionClass>
      }) {
        const [result] = yield* db
          .update(competitionClasses)
          .set(data)
          .where(eq(competitionClasses.id, id))
          .returning()

        if (!result) {
          return yield* Effect.fail(
            new SqlError({
              cause: "Failed to update competition class",
            })
          )
        }
        return result
      })

      const deleteCompetitionClass = Effect.fn(
        "CompetitionClassesQueries.deleteCompetitionClass"
      )(function* ({ id }: { id: number }) {
        const [result] = yield* db
          .delete(competitionClasses)
          .where(eq(competitionClasses.id, id))
          .returning()
        if (!result) {
          return yield* Effect.fail(
            new SqlError({
              cause: "Failed to delete competition class",
            })
          )
        }
        return result
      })

      return {
        getCompetitionClassById,
        getCompetitionClassesByDomain,
        createCompetitionClass,
        createMultipleCompetitionClasses,
        updateCompetitionClass,
        deleteCompetitionClass,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer)
  )
}
