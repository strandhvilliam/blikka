import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
  requireMatchingInputDomainMiddleware,
} from '../root'
import { trpcEffect } from '../utils'
import { Effect, Schema } from 'effect'
import {
  GetByDomainInfiniteInputSchema,
  GetByReferenceInputSchema,
  GetPublicParticipantByReferenceInputSchema,
  BatchDeleteInputSchema,
  BatchMarkCompletedInputSchema,
  BatchVerifyInputSchema,
  VerifyParticipantInputSchema,
  UpdateByCameraParticipantContactInputSchema,
  UpdateMarathonParticipantContactInputSchema,
  UpdateMarathonParticipantRegistrationInputSchema,
} from '../../core/participants/contracts'
import { ParticipantsService } from '../../core/participants/service'

export const participantRouter = createTRPCRouter({
  getPublicParticipantByReference: publicProcedure
    .input(Schema.toStandardSchemaV1(GetPublicParticipantByReferenceInputSchema))
    .query(
      trpcEffect(
        Effect.fn('ParticipantRouter.getPublicParticipantByReference')(function* ({ input }) {
          return yield* ParticipantsService.use((s) =>
            s.getPublicParticipantByReference({
              reference: input.reference,
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  getByDomainInfinite: domainProcedure
    .input(Schema.toStandardSchemaV1(GetByDomainInfiniteInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ParticipantRouter.getByDomainInfinite')(function* ({ input }) {
          return yield* ParticipantsService.use((s) =>
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
              excludeStatuses: input.excludeStatuses ? [...input.excludeStatuses] : undefined,
              includeStatuses: input.includeStatuses ? [...input.includeStatuses] : undefined,
              hasValidationErrors: input.hasValidationErrors ?? undefined,
              votedFilter: input.votedFilter ?? undefined,
            }),
          )
        }),
      ),
    ),

  getByReference: domainProcedure
    .input(Schema.toStandardSchemaV1(GetByReferenceInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ParticipantRouter.getByReference')(function* ({ input }) {
          return yield* ParticipantsService.use((s) =>
            s.getByReference({
              reference: input.reference,
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  delete: domainProcedure
    .input(Schema.toStandardSchemaV1(GetByReferenceInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ParticipantRouter.delete')(function* ({ input }) {
          return yield* ParticipantsService.use((s) =>
            s.deleteByReference({
              reference: input.reference,
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  batchDelete: domainProcedure
    .input(Schema.toStandardSchemaV1(BatchDeleteInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ParticipantRouter.batchDelete')(function* ({ input }) {
          return yield* ParticipantsService.use((s) =>
            s.batchDelete({
              ids: input.ids,
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  batchVerify: domainProcedure
    .input(Schema.toStandardSchemaV1(BatchVerifyInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ParticipantRouter.batchVerify')(function* ({ input }) {
          return yield* ParticipantsService.use((s) =>
            s.batchVerify({
              ids: input.ids,
              domain: input.domain,
            }),
          )
        }),
      ),
    ),
  batchMarkCompleted: domainProcedure
    .input(Schema.toStandardSchemaV1(BatchMarkCompletedInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ParticipantRouter.batchMarkCompleted')(function* ({ input }) {
          return yield* ParticipantsService.use((s) =>
            s.batchMarkCompleted({
              ids: input.ids,
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  verifyParticipant: domainProcedure
    .input(Schema.toStandardSchemaV1(VerifyParticipantInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ParticipantRouter.verifyParticipant')(function* ({ input }) {
          return yield* ParticipantsService.use((s) =>
            s.verifyParticipant({
              id: input.id,
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  updateByCameraParticipantContact: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateByCameraParticipantContactInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ParticipantRouter.updateByCameraParticipantContact')(function* ({ input }) {
          return yield* ParticipantsService.use((s) =>
            s.updateByCameraParticipantContact({
              domain: input.domain,
              reference: input.reference,
              firstname: input.firstname,
              lastname: input.lastname,
              email: input.email,
              phone: input.phone,
            }),
          )
        }),
      ),
    ),

  updateMarathonParticipantContact: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateMarathonParticipantContactInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ParticipantRouter.updateMarathonParticipantContact')(function* ({ input }) {
          return yield* ParticipantsService.use((s) =>
            s.updateMarathonParticipantContact({
              domain: input.domain,
              reference: input.reference,
              firstname: input.firstname,
              lastname: input.lastname,
              email: input.email,
            }),
          )
        }),
      ),
    ),

  updateMarathonParticipantRegistration: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateMarathonParticipantRegistrationInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ParticipantRouter.updateMarathonParticipantRegistration')(function* ({
          input,
        }) {
          return yield* ParticipantsService.use((s) =>
            s.updateMarathonParticipantRegistration({
              domain: input.domain,
              reference: input.reference,
              firstname: input.firstname,
              lastname: input.lastname,
              email: input.email,
              competitionClassId: input.competitionClassId,
              deviceGroupId: input.deviceGroupId,
            }),
          )
        }),
      ),
    ),
})
