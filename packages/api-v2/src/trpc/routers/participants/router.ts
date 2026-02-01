import { createTRPCRouter, domainProcedure, publicProcedure } from "../../root";
import { trpcEffect } from "../../utils";
import { Effect } from "effect";
import {
  GetByDomainInfiniteInputSchema,
  GetByReferenceInputSchema,
  GetPublicParticipantByReferenceInputSchema,
  BatchDeleteInputSchema,
  BatchVerifyInputSchema,
} from "./schemas";
import { ParticipantsApiService } from "./service";

export const participantRouter = createTRPCRouter({
  getPublicParticipantByReference: publicProcedure
    .input(GetPublicParticipantByReferenceInputSchema)
    .query(
      trpcEffect(
        Effect.fn("ParticipantRouter.getPublicParticipantByReference")(
          function* ({ input }) {
            return yield* ParticipantsApiService.getPublicParticipantByReference(
              {
                reference: input.reference,
                domain: input.domain,
              },
            );
          },
        ),
      ),
    ),

  getByDomainInfinite: domainProcedure
    .input(GetByDomainInfiniteInputSchema)
    .query(
      trpcEffect(
        Effect.fn("ParticipantRouter.getByDomainInfinite")(function* ({
          input,
          ctx,
        }) {
          return yield* ParticipantsApiService.getInfiniteParticipantsByDomain({
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

  getByReference: domainProcedure.input(GetByReferenceInputSchema).query(
    trpcEffect(
      Effect.fn("ParticipantRouter.getByReference")(function* ({ input, ctx }) {
        return yield* ParticipantsApiService.getByReference({
          reference: input.reference,
          domain: input.domain,
        });
      }),
    ),
  ),

  delete: domainProcedure.input(GetByReferenceInputSchema).mutation(
    trpcEffect(
      Effect.fn("ParticipantRouter.delete")(function* ({ input, ctx }) {
        return yield* ParticipantsApiService.deleteByReference({
          reference: input.reference,
          domain: input.domain,
        });
      }),
    ),
  ),

  batchDelete: domainProcedure.input(BatchDeleteInputSchema).mutation(
    trpcEffect(
      Effect.fn("ParticipantRouter.batchDelete")(function* ({ input, ctx }) {
        return yield* ParticipantsApiService.batchDelete({
          ids: input.ids,
          domain: input.domain,
        });
      }),
    ),
  ),

  batchVerify: domainProcedure.input(BatchVerifyInputSchema).mutation(
    trpcEffect(
      Effect.fn("ParticipantRouter.batchVerify")(function* ({ input, ctx }) {
        return yield* ParticipantsApiService.batchVerify({
          ids: input.ids,
          domain: input.domain,
        });
      }),
    ),
  ),
});
