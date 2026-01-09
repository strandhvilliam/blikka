import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import { Effect } from "effect"
import { RunValidationsSchema, CreateParticipantVerificationSchema } from "./schemas"
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
})
