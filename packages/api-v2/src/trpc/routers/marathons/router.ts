import "server-only"

import { Effect, Option } from "effect"
import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import { TRPCError } from "@trpc/server"
import {
  GetByDomainInputSchema,
  MarathonApiError,
  UpdateMarathonInputSchema,
  ResetMarathonInputSchema,
} from "./schemas"
import { Database } from "@blikka/db"
import { MarathonApiService } from "./service"

export const marathonRouter = createTRPCRouter({
  getByDomain: authProcedure.input(GetByDomainInputSchema).query(
    trpcEffect(
      Effect.fn("MarathonRouter.getByDomain")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* MarathonApiService.getMarathonByDomain({ domain: input.domain })
      })
    )
  ),
  getUserMarathons: authProcedure.query(
    trpcEffect(
      Effect.fn("MarathonRouter.getUserMarathons")(function* ({ ctx }) {
        return yield* MarathonApiService.getUserMarathons({ userId: ctx.session.user.id })
      })
    )
  ),
  update: authProcedure.input(UpdateMarathonInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.update")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* MarathonApiService.updateMarathon({ domain: input.domain, data: input.data })
      })
    )
  ),
  reset: authProcedure.input(ResetMarathonInputSchema).mutation(
    trpcEffect(
      Effect.fn("MarathonRouter.reset")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* MarathonApiService.resetMarathon({ domain: input.domain })
      })
    )
  ),
})
