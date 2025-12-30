import "server-only";

import { authProcedure, createTRPCRouter, publicProcedure } from "../root";
import { assertAllowedToAccessDomain, trpcEffect } from "../utils";
import { Schema, Effect, Option } from "effect";
import { Database } from "@blikka/db";
import { TRPCError } from "@trpc/server";

export const participantRouter = createTRPCRouter({
  getByDomainInfinite: authProcedure
    .input(
      Schema.standardSchemaV1(
        Schema.Struct({
          domain: Schema.String,
          cursor: Schema.NullishOr(Schema.String),
          limit: Schema.NullishOr(
            Schema.Number.pipe(
              Schema.greaterThan(0),
              Schema.lessThanOrEqualTo(100),
            ),
          ),
          search: Schema.NullishOr(Schema.String),
          sortOrder: Schema.NullishOr(
            Schema.Union(Schema.Literal("asc"), Schema.Literal("desc")),
          ),
          competitionClassId: Schema.NullishOr(
            Schema.Union(Schema.Number, Schema.Array(Schema.Number)),
          ),
          deviceGroupId: Schema.NullishOr(
            Schema.Union(Schema.Number, Schema.Array(Schema.Number)),
          ),
          statusFilter: Schema.NullishOr(
            Schema.Union(
              Schema.Literal("completed"),
              Schema.Literal("verified"),
            ),
          ),
          excludeStatuses: Schema.NullishOr(Schema.Array(Schema.String)),
          hasValidationErrors: Schema.NullishOr(Schema.Boolean),
        }),
      ),
    )
    .query(
      trpcEffect(
        Effect.fn(function* ({ input }) {
          const db = yield* Database;
          return yield* db.participantsQueries.getInfiniteParticipantsByDomain({
            domain: input.domain,
            cursor: input.cursor ?? undefined,
            limit: input.limit ?? undefined,
            search: input.search ?? undefined,
            sortOrder: input.sortOrder ?? undefined,
            competitionClassId: input.competitionClassId ?? undefined,
            deviceGroupId: input.deviceGroupId ?? undefined,
            statusFilter: input.statusFilter ?? undefined,
            excludeStatuses: input.excludeStatuses
              ? [...input.excludeStatuses]
              : undefined,
            hasValidationErrors: input.hasValidationErrors ?? undefined,
          });
        }),
      ),
    ),

  getByReference: authProcedure
    .input(
      Schema.standardSchemaV1(
        Schema.Struct({ reference: Schema.String, domain: Schema.String }),
      ),
    )
    .query(
      trpcEffect(
        Effect.fn(function* ({ input, ctx }) {
          yield* assertAllowedToAccessDomain({ domain: input.domain, ctx });
          const db = yield* Database;
          const result =
            yield* db.participantsQueries.getParticipantByReference({
              reference: input.reference,
              domain: input.domain,
            });

          if (Option.isNone(result)) {
            return yield* Effect.fail(
              new TRPCError({
                code: "NOT_FOUND",
                message: "Participant not found",
              }),
            );
          }
          return result.value;
        }),
      ),
    ),

  // getByReference: publicProcedure.input().query(() => {}),

  // create: publicProcedure.input().mutation(() => {}),

  // update: publicProcedure.input().mutation(() => {}),

  // delete: publicProcedure.input().mutation(() => {}),

  // incrementUploadCounter: publicProcedure.input().mutation(() => {}),
});
