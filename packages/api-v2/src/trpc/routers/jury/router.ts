import "server-only"

import { Effect } from "effect"
import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import {
  GetJuryInvitationsByDomainInputSchema,
  GetJuryInvitationByIdInputSchema,
  CreateJuryInvitationInputSchema,
  UpdateJuryInvitationInputSchema,
  DeleteJuryInvitationInputSchema,
} from "./schemas"
import { JuryApiService } from "./service"

export const juryRouter = createTRPCRouter({
  getJuryInvitationsByDomain: authProcedure
    .input(GetJuryInvitationsByDomainInputSchema)
    .query(
      trpcEffect(
        Effect.fn("JuryRouter.getJuryInvitationsByDomain")(function* ({ input, ctx }) {
          yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

          return yield* JuryApiService.getJuryInvitationsByDomain({ domain: input.domain })
        })
      )
    ),

  getJuryInvitationById: authProcedure.input(GetJuryInvitationByIdInputSchema).query(
    trpcEffect(
      Effect.fn("JuryRouter.getJuryInvitationById")(function* ({ input, ctx }) {
        // Note: We don't check domain access here since we only have the invitation ID
        // The service will handle not found errors
        return yield* JuryApiService.getJuryInvitationById({ id: input.id })
      })
    )
  ),

  createJuryInvitation: authProcedure.input(CreateJuryInvitationInputSchema).mutation(
    trpcEffect(
      Effect.fn("JuryRouter.createJuryInvitation")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* JuryApiService.createJuryInvitation({
          domain: input.domain,
          data: input.data,
        })
      })
    )
  ),

  updateJuryInvitation: authProcedure.input(UpdateJuryInvitationInputSchema).mutation(
    trpcEffect(
      Effect.fn("JuryRouter.updateJuryInvitation")(function* ({ input, ctx }) {
        // Note: We don't check domain access here since we only have the invitation ID
        // The service will handle not found errors
        return yield* JuryApiService.updateJuryInvitation({
          id: input.id,
          data: input.data,
        })
      })
    )
  ),

  deleteJuryInvitation: authProcedure.input(DeleteJuryInvitationInputSchema).mutation(
    trpcEffect(
      Effect.fn("JuryRouter.deleteJuryInvitation")(function* ({ input, ctx }) {
        // Note: We don't check domain access here since we only have the invitation ID
        // The service will handle not found errors
        return yield* JuryApiService.deleteJuryInvitation({ id: input.id })
      })
    )
  ),
})

