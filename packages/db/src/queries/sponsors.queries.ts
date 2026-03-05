import { Effect, Layer, Option, ServiceMap } from "effect";
import { sponsors } from "../schema";
import { DrizzleClient } from "../drizzle-client";
import { eq } from "drizzle-orm";
import type { NewSponsor } from "../types";
import { DbError } from "../utils";
export class SponsorsQueries extends ServiceMap.Service<SponsorsQueries>()(
  "@blikka/db/sponsors-queries",
  {
    make: Effect.gen(function* () {
      const { use } = yield* DrizzleClient;
      const getSponsorsByMarathonId = Effect.fn(
        "SponsorsQueries.getSponsorsByMarathonId",
      )(function* ({ marathonId }: { marathonId: number }) {
        const result = yield* use((db) =>
          db.query.sponsors.findMany({
            where: (table, operators) =>
              operators.eq(table.marathonId, marathonId),
          }),
        );
        return result;
      });
      const getLatestSponsorByType = Effect.fn(
        "SponsorsQueries.getLatestSponsorByType",
      )(function* ({ marathonId, type }: { marathonId: number; type: string }) {
        const result = yield* use((db) =>
          db.query.sponsors.findFirst({
            where: (table, operators) =>
              operators.and(
                operators.eq(table.marathonId, marathonId),
                operators.eq(table.type, type),
              ),
            orderBy: (table, operators) => operators.desc(table.createdAt),
          }),
        );
        return Option.fromNullishOr(result);
      });
      const getSponsorsByType = Effect.fn("SponsorsQueries.getSponsorsByType")(
        function* ({ marathonId, type }: { marathonId: number; type: string }) {
          const result = yield* use((db) =>
            db.query.sponsors.findMany({
              where: (table, operators) =>
                operators.and(
                  operators.eq(table.marathonId, marathonId),
                  operators.eq(table.type, type),
                ),
            }),
          );
          return result;
        },
      );
      const getSponsorById = Effect.fn("SponsorsQueries.getSponsorById")(
        function* ({ id }: { id: number }) {
          const result = yield* use((db) =>
            db.query.sponsors.findFirst({
              where: (table, operators) => operators.eq(table.id, id),
            }),
          );
          return Option.fromNullishOr(result);
        },
      );
      const createSponsor = Effect.fn("SponsorsQueries.createSponsor")(
        function* ({ data }: { data: NewSponsor }) {
          const [result] = yield* use((db) =>
            db
              .insert(sponsors)
              .values({
                ...data,
                uploadedAt: data.uploadedAt || new Date().toISOString(),
              })
              .returning(),
          );
          if (!result) {
            return yield* Effect.fail(
              new DbError({
                message: "Failed to create sponsor",
              }),
            );
          }
          return result;
        },
      );
      const updateSponsor = Effect.fn("SponsorsQueries.updateSponsor")(
        function* ({ id, data }: { id: number; data: Partial<NewSponsor> }) {
          const updateData = {
            ...data,
            ...(data.key && { uploadedAt: new Date().toISOString() }),
          };
          const [result] = yield* use((db) =>
            db
              .update(sponsors)
              .set(updateData)
              .where(eq(sponsors.id, id))
              .returning(),
          );
          if (!result) {
            return yield* Effect.fail(
              new DbError({
                message: "Failed to update sponsor",
              }),
            );
          }
          return result;
        },
      );
      const deleteSponsor = Effect.fn("SponsorsQueries.deleteSponsor")(
        function* ({ id }: { id: number }) {
          const [result] = yield* use((db) =>
            db
              .delete(sponsors)
              .where(eq(sponsors.id, id))
              .returning({ id: sponsors.id }),
          );
          if (!result) {
            return yield* Effect.fail(
              new DbError({
                message: "Failed to delete sponsor",
              }),
            );
          }
          return result;
        },
      );
      return {
        getSponsorsByMarathonId,
        getLatestSponsorByType,
        getSponsorsByType,
        getSponsorById,
        createSponsor,
        updateSponsor,
        deleteSponsor,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer),
  );
}
