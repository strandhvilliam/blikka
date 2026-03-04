import { Effect, Layer, Option, ServiceMap } from "effect"
import { sponsors } from "../schema"
import { DrizzleClient } from "../drizzle-client"
import { and, desc, eq } from "drizzle-orm"
import type { NewSponsor } from "../types"
import { SqlError } from "@effect/sql/SqlError"

export class SponsorsQueries extends ServiceMap.Service<SponsorsQueries>()(
  "@blikka/db/sponsors-queries",
  {
    make: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getSponsorsByMarathonId = Effect.fn(
        "SponsorsQueries.getSponsorsByMarathonId",
      )(function* ({ marathonId }: { marathonId: number }) {
        const result = yield* db.query.sponsors.findMany({
          where: eq(sponsors.marathonId, marathonId),
        })
        return result
      })

      const getLatestSponsorByType = Effect.fn(
        "SponsorsQueries.getLatestSponsorByType",
      )(function* ({ marathonId, type }: { marathonId: number; type: string }) {
        const result = yield* db.query.sponsors.findFirst({
          where: and(
            eq(sponsors.marathonId, marathonId),
            eq(sponsors.type, type),
          ),
          orderBy: desc(sponsors.createdAt),
        })
        return Option.fromNullishOr(result)
      })

      const getSponsorsByType = Effect.fn("SponsorsQueries.getSponsorsByType")(
        function* ({ marathonId, type }: { marathonId: number; type: string }) {
          const result = yield* db.query.sponsors.findMany({
            where: and(
              eq(sponsors.marathonId, marathonId),
              eq(sponsors.type, type),
            ),
          })
          return result
        },
      )

      const getSponsorById = Effect.fn("SponsorsQueries.getSponsorById")(
        function* ({ id }: { id: number }) {
          const result = yield* db.query.sponsors.findFirst({
            where: eq(sponsors.id, id),
          })
          return Option.fromNullishOr(result)
        },
      )

      const createSponsor = Effect.fn("SponsorsQueries.createSponsor")(
        function* ({ data }: { data: NewSponsor }) {
          const [result] = yield* db
            .insert(sponsors)
            .values({
              ...data,
              uploadedAt: data.uploadedAt || new Date().toISOString(),
            })
            .returning()

          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to create sponsor",
              }),
            )
          }
          return result
        },
      )

      const updateSponsor = Effect.fn("SponsorsQueries.updateSponsor")(
        function* ({ id, data }: { id: number; data: Partial<NewSponsor> }) {
          const updateData = {
            ...data,
            ...(data.key && { uploadedAt: new Date().toISOString() }),
          }

          const [result] = yield* db
            .update(sponsors)
            .set(updateData)
            .where(eq(sponsors.id, id))
            .returning()

          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to update sponsor",
              }),
            )
          }
          return result
        },
      )

      const deleteSponsor = Effect.fn("SponsorsQueries.deleteSponsor")(
        function* ({ id }: { id: number }) {
          const [result] = yield* db
            .delete(sponsors)
            .where(eq(sponsors.id, id))
            .returning({ id: sponsors.id })

          if (!result) {
            return yield* Effect.fail(
              new SqlError({
                cause: "Failed to delete sponsor",
              }),
            )
          }
          return result
        },
      )

      return {
        getSponsorsByMarathonId,
        getLatestSponsorByType,
        getSponsorsByType,
        getSponsorById,
        createSponsor,
        updateSponsor,
        deleteSponsor,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer)
  )
}
