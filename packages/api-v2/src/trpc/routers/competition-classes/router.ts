import "server-only"

import { Effect, Option } from "effect"
import { authProcedure, createTRPCRouter } from "../../root"
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
  create: authProcedure.input(CreateCompetitionClassInputSchema).mutation(
    trpcEffect(
      Effect.fn("CompetitionClassesRouter.create")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* CompetitionClassesApiService.createCompetitionClass({
          data: input.data,
          domain: input.domain,
        })
      })
    )
  ),

  update: authProcedure.input(UpdateCompetitionClassInputSchema).mutation(
    trpcEffect(
      Effect.fn("CompetitionClassesRouter.update")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* CompetitionClassesApiService.updateCompetitionClass({
          id: input.id,
          data: input.data,
          domain: input.domain,
        })
      })
    )
  ),

  delete: authProcedure.input(DeleteCompetitionClassInputSchema).mutation(
    trpcEffect(
      Effect.fn("CompetitionClassesRouter.delete")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })
      })
    )
  ),
})
