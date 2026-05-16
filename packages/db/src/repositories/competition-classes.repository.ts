import { Effect, Layer, Option, Context } from "effect";
import { DrizzleClient } from "../drizzle-client";
import { competitionClasses, marathons } from "../schema";
import { eq } from "drizzle-orm";
import type { NewCompetitionClass } from "../types";
import { DbError } from "../utils";
export class CompetitionClassesRepository extends Context.Service<CompetitionClassesRepository>()(
  "@blikka/db/competition-classes-repository",
  {
    make: Effect.gen(function* () {
      const { use } = yield* DrizzleClient;
      const getCompetitionClassById = Effect.fn(
        "CompetitionClassesRepository.getCompetitionClassById",
      )(function* ({ id }: { id: number }) {
        const result = yield* use((db) =>
          db.query.competitionClasses.findFirst({
            where: (table, operators) => operators.eq(table.id, id),
          }),
        );
        return Option.fromNullishOr(result);
      });
      const getCompetitionClassesByDomain = Effect.fn(
        "CompetitionClassesRepository.getCompetitionClassesByDomain",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* use((db) =>
          db
            .select()
            .from(competitionClasses)
            .innerJoin(
              marathons,
              eq(competitionClasses.marathonId, marathons.id),
            )
            .where(eq(marathons.domain, domain)),
        );
        return result.map((row) => row.competition_classes);
      });
      const createCompetitionClass = Effect.fn(
        "CompetitionClassesRepository.createCompetitionClass",
      )(function* ({ data }: { data: NewCompetitionClass }) {
        const [result] = yield* use((db) =>
          db.insert(competitionClasses).values(data).returning(),
        );
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to create competition class",
            }),
          );
        }
        return result;
      });
      const createMultipleCompetitionClasses = Effect.fn(
        "CompetitionClassesRepository.createMultipleCompetitionClasses",
      )(function* ({ data }: { data: NewCompetitionClass[] }) {
        const result = yield* use((db) =>
          db.insert(competitionClasses).values(data).returning(),
        );
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to create multiple competition classes",
            }),
          );
        }
        return result;
      });
      const updateCompetitionClass = Effect.fn(
        "CompetitionClassesRepository.updateCompetitionClass",
      )(function* ({
        id,
        data,
      }: {
        id: number;
        data: Partial<NewCompetitionClass>;
      }) {
        const [result] = yield* use((db) =>
          db
            .update(competitionClasses)
            .set(data)
            .where(eq(competitionClasses.id, id))
            .returning(),
        );
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update competition class",
            }),
          );
        }
        return result;
      });
      const deleteCompetitionClass = Effect.fn(
        "CompetitionClassesRepository.deleteCompetitionClass",
      )(function* ({ id }: { id: number }) {
        const [result] = yield* use((db) =>
          db
            .delete(competitionClasses)
            .where(eq(competitionClasses.id, id))
            .returning(),
        );
        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to delete competition class",
            }),
          );
        }
        return result;
      });
      return {
        getCompetitionClassById,
        getCompetitionClassesByDomain,
        createCompetitionClass,
        createMultipleCompetitionClasses,
        updateCompetitionClass,
        deleteCompetitionClass,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  );
}
