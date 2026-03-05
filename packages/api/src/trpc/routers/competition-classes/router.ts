import "server-only"

import { Effect } from "effect"
import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import {
  CreateCompetitionClassInputSchema,
  UpdateCompetitionClassInputSchema,
  DeleteCompetitionClassInputSchema,
} from "./schemas"
import { CompetitionClassesApiService } from "./service"

export const competitionClassesRouter = createTRPCRouter({
  create: domainProcedure.input(CreateCompetitionClassInputSchema).mutation(
    trpcEffect(
      Effect.fn("CompetitionClassesRouter.create")(function* ({ input }) {
        return yield* CompetitionClassesApiService.use((s) =>
          s.createCompetitionClass({
            data: input.data,
            domain: input.domain,
          })
        )
      })
    )
  ),

  update: domainProcedure.input(UpdateCompetitionClassInputSchema).mutation(
    trpcEffect(
      Effect.fn("CompetitionClassesRouter.update")(function* ({ input }) {
        return yield* CompetitionClassesApiService.use((s) =>
          s.updateCompetitionClass({
            id: input.id,
            data: input.data,
            domain: input.domain,
          })
        )
      })
    )
  ),

  delete: domainProcedure.input(DeleteCompetitionClassInputSchema).mutation(
    trpcEffect(
      Effect.fn("CompetitionClassesRouter.delete")(function* ({ input }) {
        return yield* CompetitionClassesApiService.use((s) =>
          s.deleteCompetitionClass({
            id: input.id,
            domain: input.domain,
          })
        )
      })
    )
  ),
})
