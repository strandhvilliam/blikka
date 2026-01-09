import "server-only"

import { Effect, Option } from "effect"
import { createTRPCRouter, domainProcedure } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import { Database } from "@blikka/db"
import {
  CreateCompetitionClassInputSchema,
  UpdateCompetitionClassInputSchema,
  DeleteCompetitionClassInputSchema,
  CompetitionClassApiError,
} from "./schemas"
import { CompetitionClassesApiService } from "./service"

export const competitionClassesRouter = createTRPCRouter({
  create: domainProcedure.input(CreateCompetitionClassInputSchema).mutation(
    trpcEffect(
      Effect.fn("CompetitionClassesRouter.create")(function* ({ input }) {
        return yield* CompetitionClassesApiService.createCompetitionClass({
          data: input.data,
          domain: input.domain,
        })
      })
    )
  ),

  update: domainProcedure.input(UpdateCompetitionClassInputSchema).mutation(
    trpcEffect(
      Effect.fn("CompetitionClassesRouter.update")(function* ({ input }) {
        return yield* CompetitionClassesApiService.updateCompetitionClass({
          id: input.id,
          data: input.data,
          domain: input.domain,
        })
      })
    )
  ),

  delete: domainProcedure.input(DeleteCompetitionClassInputSchema).mutation(
    trpcEffect(
      Effect.fn("CompetitionClassesRouter.delete")(function* ({ input }) {
        return yield* CompetitionClassesApiService.deleteCompetitionClass({
          id: input.id,
          domain: input.domain,
        })
      })
    )
  ),
})
