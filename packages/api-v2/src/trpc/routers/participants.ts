import { createTRPCRouter, publicProcedure } from "../root"
import { trpcEffect } from "../utils"
import { Schema, Effect } from "effect"
import { Database } from "@blikka/db"

export const participantRouter = createTRPCRouter({
  // getByDomainInfinite: publicProcedure
  //   .input(
  //     Schema.standardSchemaV1(
  //       Schema.Struct({
  //         domain: Schema.String,
  //         cursor: Schema.NullishOr(Schema.String),
  //         limit: Schema.NullishOr(
  //           Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(100))
  //         ),
  //         search: Schema.NullishOr(Schema.String),
  //         sortOrder: Schema.NullishOr(Schema.Union(Schema.Literal("asc"), Schema.Literal("desc"))),
  //         competitionClassId: Schema.NullishOr(
  //           Schema.Union(Schema.Number, Schema.Array(Schema.Number))
  //         ),
  //         deviceGroupId: Schema.NullishOr(Schema.Union(Schema.Number, Schema.Array(Schema.Number))),
  //       })
  //     )
  //   )
  //   .query(
  //     trpcEffect(({ input }) =>
  //       Effect.gen(function* () {
  //         const db = yield* Database
  //         return yield* db.participantsQueries.getParticipantsByDomain({
  //           domain: input.domain,
  //           cursor: input.cursor ?? undefined,
  //           limit: input.limit ?? undefined,
  //           search: input.search ?? undefined,
  //           sortOrder: input.sortOrder ?? undefined,
  //           competitionClassId: input.competitionClassId ?? undefined,
  //           deviceGroupId: input.deviceGroupId ?? undefined,
  //         })
  //       })
  //     )
  //   ),

  getById: publicProcedure
    .input(Schema.standardSchemaV1(Schema.Struct({ id: Schema.Number })))
    .query(() => {}),

  // getByReference: publicProcedure.input().query(() => {}),

  // create: publicProcedure.input().mutation(() => {}),

  // update: publicProcedure.input().mutation(() => {}),

  // delete: publicProcedure.input().mutation(() => {}),

  // incrementUploadCounter: publicProcedure.input().mutation(() => {}),
})
