import { Effect, Layer, Option, Context } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { competitionClasses, marathons } from "../schema"
import { eq } from "drizzle-orm"
import type { CompetitionClass, NewCompetitionClass } from "../types"
import { DbError } from "../utils"

export class CompetitionClassesRepository extends Context.Service<
  CompetitionClassesRepository,
  {
    /** Competition class row by primary key, or none if missing. */
    readonly getCompetitionClassById: (params: {
      id: number
    }) => Effect.Effect<Option.Option<CompetitionClass>, DbError>
    /** Competition classes belonging to the marathon identified by domain. */
    readonly getCompetitionClassesByDomain: (params: {
      domain: string
    }) => Effect.Effect<CompetitionClass[], DbError>
    /** Insert a new competition class row. */
    readonly createCompetitionClass: (params: {
      data: NewCompetitionClass
    }) => Effect.Effect<CompetitionClass, DbError>
    /** Insert multiple competition class rows. */
    readonly createMultipleCompetitionClasses: (params: {
      data: NewCompetitionClass[]
    }) => Effect.Effect<CompetitionClass[], DbError>
    /** Patch fields on a competition class identified by id. */
    readonly updateCompetitionClass: (params: {
      id: number
      data: Partial<NewCompetitionClass>
    }) => Effect.Effect<CompetitionClass, DbError>
    /** Delete a competition class by id. */
    readonly deleteCompetitionClass: (params: {
      id: number
    }) => Effect.Effect<CompetitionClass, DbError>
  }
>()("@blikka/db/competition-classes-repository") {}

const makeCompetitionClassesRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient

  const getCompetitionClassById: CompetitionClassesRepository["Service"]["getCompetitionClassById"] =
    Effect.fn("CompetitionClassesRepository.getCompetitionClassById")(function* ({ id }) {
      const result = yield* use((db) =>
        db.query.competitionClasses.findFirst({
          where: (table, operators) => operators.eq(table.id, id),
        }),
      )
      return Option.fromNullishOr(result)
    })

  const getCompetitionClassesByDomain: CompetitionClassesRepository["Service"]["getCompetitionClassesByDomain"] =
    Effect.fn("CompetitionClassesRepository.getCompetitionClassesByDomain")(function* ({ domain }) {
      const result = yield* use((db) =>
        db
          .select()
          .from(competitionClasses)
          .innerJoin(marathons, eq(competitionClasses.marathonId, marathons.id))
          .where(eq(marathons.domain, domain)),
      )
      return result.map((row) => row.competition_classes)
    })

  const createCompetitionClass: CompetitionClassesRepository["Service"]["createCompetitionClass"] =
    Effect.fn("CompetitionClassesRepository.createCompetitionClass")(function* ({ data }) {
      const [result] = yield* use((db) => db.insert(competitionClasses).values(data).returning())
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: "Failed to create competition class",
          }),
        )
      }
      return result
    })

  const createMultipleCompetitionClasses: CompetitionClassesRepository["Service"]["createMultipleCompetitionClasses"] =
    Effect.fn("CompetitionClassesRepository.createMultipleCompetitionClasses")(function* ({
      data,
    }) {
      const result = yield* use((db) => db.insert(competitionClasses).values(data).returning())
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: "Failed to create multiple competition classes",
          }),
        )
      }
      return result
    })

  const updateCompetitionClass: CompetitionClassesRepository["Service"]["updateCompetitionClass"] =
    Effect.fn("CompetitionClassesRepository.updateCompetitionClass")(function* ({ id, data }) {
      const [result] = yield* use((db) =>
        db.update(competitionClasses).set(data).where(eq(competitionClasses.id, id)).returning(),
      )
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: "Failed to update competition class",
          }),
        )
      }
      return result
    })

  const deleteCompetitionClass: CompetitionClassesRepository["Service"]["deleteCompetitionClass"] =
    Effect.fn("CompetitionClassesRepository.deleteCompetitionClass")(function* ({ id }) {
      const [result] = yield* use((db) =>
        db.delete(competitionClasses).where(eq(competitionClasses.id, id)).returning(),
      )
      if (!result) {
        return yield* Effect.fail(
          new DbError({
            message: "Failed to delete competition class",
          }),
        )
      }
      return result
    })

  return CompetitionClassesRepository.of({
    getCompetitionClassById,
    getCompetitionClassesByDomain,
    createCompetitionClass,
    createMultipleCompetitionClasses,
    updateCompetitionClass,
    deleteCompetitionClass,
  })
})

export const CompetitionClassesRepositoryLayerNoDeps = Layer.effect(
  CompetitionClassesRepository,
  makeCompetitionClassesRepository,
)

export const CompetitionClassesRepositoryLayer = CompetitionClassesRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
