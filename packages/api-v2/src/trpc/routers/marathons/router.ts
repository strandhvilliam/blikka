import "server-only"

import { Effect, Option } from "effect"
import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import { TRPCError } from "@trpc/server"
import { GetByDomainInputSchema, MarathonApiError } from "./schemas"
import { Database } from "@blikka/db"

export const marathonRouter = createTRPCRouter({
  getByDomain: authProcedure.input(GetByDomainInputSchema).query(
    trpcEffect(
      Effect.fn("MarathonRouter.getByDomain")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        const db = yield* Database
        const marathon = yield* db.marathonsQueries.getMarathonByDomainWithOptions({
          domain: input.domain,
        })

        return yield* Option.match(marathon, {
          onSome: (marathon) => Effect.succeed(marathon),
          onNone: () =>
            Effect.fail(
              new MarathonApiError({
                message: `Marathon not found for domain ${input.domain}`,
              })
            ),
        })
      })
    )
  ),
  getUserMarathons: authProcedure.query(
    trpcEffect(
      Effect.fn("MarathonRouter.getUserMarathons")(function* ({ ctx }) {
        const db = yield* Database
        return yield* db.usersQueries.getMarathonsByUserId({
          userId: ctx.session.user.id,
        })
      })
    )
  ),
})
