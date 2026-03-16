import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { trpcEffect } from "../../utils";
import { Effect } from "effect";
import {
  GetByDomainInfiniteInputSchema,
  GetByReferenceInputSchema,
  GetPublicParticipantByReferenceInputSchema,
  BatchDeleteInputSchema,
  BatchVerifyInputSchema,
  VerifyParticipantInputSchema,
} from "./schemas";
import { ParticipantsApiService } from "./service";

export const participantRouter = createTRPCRouter({
  getPublicParticipantByReference: publicProcedure
    .input(GetPublicParticipantByReferenceInputSchema)
    .query(
      trpcEffect(
        Effect.fn("ParticipantRouter.getPublicParticipantByReference")(
          function* ({ input }) {
            return yield* ParticipantsApiService.use((s) =>
              s.getPublicParticipantByReference({
                reference: input.reference,
                domain: input.domain,
              }),
            );
          },
        ),
      ),
    ),

  getByDomainInfinite: domainProcedure
    .input(GetByDomainInfiniteInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ParticipantRouter.getByDomainInfinite")(function* ({
          input,
        }) {
          return yield* ParticipantsApiService.use((s) =>
            s.getInfiniteParticipantsByDomain({
              domain: input.domain,
              cursor: input.cursor ?? undefined,
              limit: input.limit ?? undefined,
              search: input.search ?? undefined,
              sortOrder: input.sortOrder ?? undefined,
              competitionClassId: input.competitionClassId ?? undefined,
              deviceGroupId: input.deviceGroupId ?? undefined,
              topicId: input.topicId ?? undefined,
              statusFilter: input.statusFilter ?? undefined,
              excludeStatuses: input.excludeStatuses
                ? [...input.excludeStatuses]
                : undefined,
              includeStatuses: input.includeStatuses
                ? [...input.includeStatuses]
                : undefined,
              hasValidationErrors: input.hasValidationErrors ?? undefined,
              votedFilter: input.votedFilter ?? undefined,
            }),
          );
        }),
      ),
    ),

  getByReference: domainProcedure
    .input(GetByReferenceInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("ParticipantRouter.getByReference")(function* ({ input }) {
          return yield* ParticipantsApiService.use((s) =>
            s.getByReference({
              reference: input.reference,
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  delete: domainProcedure
    .input(GetByReferenceInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("ParticipantRouter.delete")(function* ({ input }) {
          return yield* ParticipantsApiService.use((s) =>
            s.deleteByReference({
              reference: input.reference,
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  batchDelete: domainProcedure
    .input(BatchDeleteInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("ParticipantRouter.batchDelete")(function* ({ input }) {
          return yield* ParticipantsApiService.use((s) =>
            s.batchDelete({
              ids: input.ids,
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  batchVerify: domainProcedure
    .input(BatchVerifyInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("ParticipantRouter.batchVerify")(function* ({ input }) {
          return yield* ParticipantsApiService.use((s) =>
            s.batchVerify({
              ids: input.ids,
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  verifyParticipant: domainProcedure
    .input(VerifyParticipantInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("ParticipantRouter.verifyParticipant")(function* ({ input }) {
          return yield* ParticipantsApiService.use((s) =>
            s.verifyParticipant({
              id: input.id,
              domain: input.domain,
            }),
          );
        }),
      ),
    ),
});
