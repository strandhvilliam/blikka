import "server-only"

import { Effect } from "effect"
import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import { GetByDomainInputSchema, UpdateMultipleInputSchema } from "./schemas"
import { RulesApiService } from "./service"

export const rulesRouter = createTRPCRouter({
  getByDomain: domainProcedure.input(GetByDomainInputSchema).query(
    trpcEffect(
      Effect.fn("RulesRouter.getByDomain")(function* ({ input }) {
        return yield* RulesApiService.getRulesByDomain({ domain: input.domain })
      })
    )
  ),

  updateMultiple: domainProcedure.input(UpdateMultipleInputSchema).mutation(
    trpcEffect(
      Effect.fn("RulesRouter.updateMultiple")(function* ({ input }) {
        return yield* RulesApiService.updateMultipleRules({
          domain: input.domain,
          data: [...input.data],
        })
      })
    )
  ),
})
