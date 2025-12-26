import { createTRPCRouter, publicProcedure } from "../root"
import { trpcEffect } from "../utils"
import { Schema, Effect } from "effect"
import { Database } from "@blikka/db"

export const participantRouter = createTRPCRouter({
  getByDomainInfinite: publicProcedure
    .input(
      Schema.standardSchemaV1(
        Schema.Struct({
          domain: Schema.String,
          cursor: Schema.NullishOr(Schema.String),
          limit: Schema.NullishOr(
            Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(100))
          ),
          search: Schema.NullishOr(Schema.String),
          sortOrder: Schema.NullishOr(Schema.Union(Schema.Literal("asc"), Schema.Literal("desc"))),
          competitionClassId: Schema.NullishOr(
            Schema.Union(Schema.Number, Schema.Array(Schema.Number))
          ),
          deviceGroupId: Schema.NullishOr(Schema.Union(Schema.Number, Schema.Array(Schema.Number))),
          statusFilter: Schema.NullishOr(
            Schema.Union(Schema.Literal("completed"), Schema.Literal("verified"))
          ),
          excludeStatuses: Schema.NullishOr(Schema.Array(Schema.String)),
          hasValidationErrors: Schema.NullishOr(Schema.Boolean),
        })
      )
    )
    .query(
      trpcEffect(
        Effect.fn(function* ({ input }) {
          const db = yield* Database
          return yield* db.participantsQueries.getInfiniteParticipantsByDomain({
            domain: input.domain,
            cursor: input.cursor ?? undefined,
            limit: input.limit ?? undefined,
            search: input.search ?? undefined,
            sortOrder: input.sortOrder ?? undefined,
            competitionClassId: input.competitionClassId ?? undefined,
            deviceGroupId: input.deviceGroupId ?? undefined,
            statusFilter: input.statusFilter ?? undefined,
            excludeStatuses: input.excludeStatuses ? [...input.excludeStatuses] : undefined,
            hasValidationErrors: input.hasValidationErrors ?? undefined,
          })
        })
      )
    ),

  getById: publicProcedure
    .input(Schema.standardSchemaV1(Schema.Struct({ id: Schema.Number })))
    .query(() => {}),

  // getByReference: publicProcedure.input().query(() => {}),

  // create: publicProcedure.input().mutation(() => {}),

  // update: publicProcedure.input().mutation(() => {}),

  // delete: publicProcedure.input().mutation(() => {}),

  // incrementUploadCounter: publicProcedure.input().mutation(() => {}),
})
