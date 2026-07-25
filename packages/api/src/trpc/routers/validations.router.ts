import { createTRPCRouter, domainProcedure, requireMatchingInputDomainMiddleware } from '../root'
import { trpcEffect } from '../utils'
import { Effect, Schema } from 'effect'
import {
  RunValidationsSchema,
  CreateParticipantVerificationSchema,
  UpdateValidationResultSchema,
  GetParticipantVerificationByReferenceSchema,
} from '../../core/validations/contracts'
import { ValidationsService } from '../../core/validations/service'

export const validationsRouter = createTRPCRouter({
  runValidations: domainProcedure
    .input(Schema.toStandardSchemaV1(RunValidationsSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ValidationsRouter.runValidations')(function* ({ input }) {
          return yield* ValidationsService.use((s) =>
            s.runValidations({
              domain: input.domain,
              reference: input.reference,
            }),
          )
        }),
      ),
    ),
  getParticipantVerificationByReference: domainProcedure
    .input(Schema.toStandardSchemaV1(GetParticipantVerificationByReferenceSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('ValidationsRouter.getParticipantVerificationByReference')(function* ({ input }) {
          return yield* ValidationsService.use((s) =>
            s.getParticipantVerificationByReference({
              domain: input.domain,
              reference: input.reference,
            }),
          )
        }),
      ),
    ),
  createParticipantVerification: domainProcedure
    .input(Schema.toStandardSchemaV1(CreateParticipantVerificationSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ValidationsRouter.createParticipantVerification')(function* ({ input, ctx }) {
          return yield* ValidationsService.use((s) =>
            s.createParticipantVerification({
              participantId: input.data.participantId,
              staffId: ctx.session.user.id,
              domain: input.domain,
              notes: input.data.notes,
              overruleBlockingValidations: input.data.overruleBlockingValidations,
            }),
          )
        }),
      ),
    ),
  updateValidationResult: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateValidationResultSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('ValidationsRouter.updateValidationResult')(function* ({ input }) {
          return yield* ValidationsService.use((s) =>
            s.updateValidationResult({
              id: input.id,
              domain: input.domain,
              data: {
                overruled: input.data.overruled,
              },
            }),
          )
        }),
      ),
    ),
})
