import "server-only"

import { Effect } from "effect"
import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import {
  GetJuryInvitationsByDomainInputSchema,
  GetJuryInvitationByIdInputSchema,
  CreateJuryInvitationInputSchema,
  UpdateJuryInvitationInputSchema,
  DeleteJuryInvitationInputSchema,
} from "./schemas"
import { JuryApiService } from "./service"

export const juryRouter = createTRPCRouter({
  getJuryInvitationsByDomain: domainProcedure.input(GetJuryInvitationsByDomainInputSchema).query(
    trpcEffect(
      Effect.fn("JuryRouter.getJuryInvitationsByDomain")(function* ({ input }) {
        return yield* JuryApiService.getJuryInvitationsByDomain({ domain: input.domain })
      })
    )
  ),

  getJuryInvitationById: domainProcedure.input(GetJuryInvitationByIdInputSchema).query(
    trpcEffect(
      Effect.fn("JuryRouter.getJuryInvitationById")(function* ({ input }) {
        return yield* JuryApiService.getJuryInvitationById({ id: input.id })
      })
    )
  ),

  createJuryInvitation: domainProcedure.input(CreateJuryInvitationInputSchema).mutation(
    trpcEffect(
      Effect.fn("JuryRouter.createJuryInvitation")(function* ({ input }) {
        return yield* JuryApiService.createJuryInvitation({
          domain: input.domain,
          data: input.data,
        })
      })
    )
  ),

  updateJuryInvitation: domainProcedure.input(UpdateJuryInvitationInputSchema).mutation(
    trpcEffect(
      Effect.fn("JuryRouter.updateJuryInvitation")(function* ({ input }) {
        return yield* JuryApiService.updateJuryInvitation({
          id: input.id,
          data: input.data,
        })
      })
    )
  ),

  deleteJuryInvitation: domainProcedure.input(DeleteJuryInvitationInputSchema).mutation(
    trpcEffect(
      Effect.fn("JuryRouter.deleteJuryInvitation")(function* ({ input }) {
        return yield* JuryApiService.deleteJuryInvitation({ id: input.id })
      })
    )
  ),
})
