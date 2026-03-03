import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import { Effect } from "effect"
import {
  RunValidationsSchema,
  CreateParticipantVerificationSchema,
  UpdateValidationResultSchema,
  GetParticipantVerificationByReferenceSchema,
} from "./schemas"
import { ValidationsApiService } from "./service"

export const validationsRouter = createTRPCRouter({
  runValidations: domainProcedure.input(RunValidationsSchema).mutation(
    trpcEffect(
      Effect.fn("ValidationsRouter.runValidations")(function* ({ input }) {
        return yield* ValidationsApiService.runValidations({
          domain: input.domain,
          reference: input.reference,
        })
        })
      )
    ),
  getParticipantVerificationByReference: domainProcedure
    .input(GetParticipantVerificationByReferenceSchema)
    .query(
      trpcEffect(
        Effect.fn("ValidationsRouter.getParticipantVerificationByReference")(function* ({
          input,
        }) {
          return yield* ValidationsApiService.getParticipantVerificationByReference({
            domain: input.domain,
            reference: input.reference,
          })
        })
      )
    ),
  createParticipantVerification: domainProcedure
    .input(CreateParticipantVerificationSchema)
    .mutation(
      trpcEffect(
        Effect.fn("ValidationsRouter.createParticipantVerification")(function* ({ input, ctx }) {
          return yield* ValidationsApiService.createParticipantVerification({
            participantId: input.data.participantId,
            staffId: ctx.session.user.id,
            notes: input.data.notes,
          })
        })
      )
    ),
  updateValidationResult: domainProcedure.input(UpdateValidationResultSchema).mutation(
    trpcEffect(
      Effect.fn("ValidationsRouter.updateValidationResult")(function* ({ input }) {
        return yield* ValidationsApiService.updateValidationResult({
          id: input.id,
          data: {
            overruled: input.data.overruled,
          },
        })
      })
    )
  ),
})
