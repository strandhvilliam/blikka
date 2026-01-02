import "server-only"

import { Effect } from "effect"
import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import { GetByDomainInputSchema, UpdateMultipleInputSchema } from "./schemas"
import { RulesApiService } from "./service"

export const rulesRouter = createTRPCRouter({
  getByDomain: authProcedure.input(GetByDomainInputSchema).query(
    trpcEffect(
      Effect.fn("RulesRouter.getByDomain")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* RulesApiService.getRulesByDomain({ domain: input.domain })
      })
    )
  ),

  updateMultiple: authProcedure.input(UpdateMultipleInputSchema).mutation(
    trpcEffect(
      Effect.fn("RulesRouter.updateMultiple")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* RulesApiService.updateMultipleRules({
          domain: input.domain,
          data: [...input.data],
        })
      })
    )
  ),
})
